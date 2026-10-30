import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  accounts,
  createOrganization,
  createTestDatabase,
  professionalData,
  runAs,
  saveProfessional,
  saveService,
  serviceData,
} from "../helpers/database";

let db: PGlite;
let org: string;
let foreign: string;
let staff: string;
let second: string;
let service: string;
let day: string;
const at = (hour: string) => `${day}T${hour}:00-03:00`;
const slots = (
  profile = staff,
  date = day,
  appointment: string | null = null,
) =>
  db.query<{ starts_at: Date }>(
    "select * from public.get_available_slots($1,$2,$3,$4,$5)",
    [org, service, profile, date, appointment],
  );
const reserve = async (
  hour: string,
  key = crypto.randomUUID(),
  profile = staff,
) =>
  (
    await db.query<{ id: string }>(
      "select public.create_appointment($1,$2,$3,$4,'Cliente de prueba','cliente@example.test','','pending',$5) id",
      [org, service, profile, at(hour), key],
    )
  ).rows[0]!.id;
beforeAll(async () => {
  db = await createTestDatabase("20261021000300");
  org = await createOrganization(db, accounts.owner, "reservas");
  foreign = await createOrganization(db, accounts.other, "ajeno");
  day = (
    await db.query<{ target_day: string }>(
      "select to_char(current_date+7,'YYYY-MM-DD') as target_day",
    )
  ).rows[0]!.target_day;
  await runAs(db, accounts.owner, async () => {
    await db.query("select public.save_booking_settings($1,0,365)", [org]);
    staff = await saveProfessional(db, org);
    second = await saveProfessional(db, org, [], {
      ...professionalData,
      name: "Otro profesional",
    });
    service = await saveService(db, org, [staff, second]);
    for (let weekday = 0; weekday < 7; weekday++)
      for (const scope of [null, staff, second])
        await db.query(
          "select public.save_availability_rule($1,null,$2,$3,'working',0,1440)",
          [org, scope, weekday],
        );
  });
});
afterAll(async () => {
  await db?.close();
});
describe("motor de disponibilidad y reservas PostgreSQL", () => {
  it("intersecta horarios y descuenta preparación, descansos, días completos y bloqueos parciales", async () =>
    runAs(db, accounts.owner, async () => {
      expect((await slots()).rows.length).toBeGreaterThan(50);
      await db.query(
        "select public.save_availability_rule($1,null,$2,extract(dow from $3::date)::int,'break',720,780)",
        [org, staff, day],
      );
      const result = (await slots()).rows.map((row) =>
        new Date(row.starts_at).toISOString(),
      );
      expect(result).not.toContain(new Date(at("11:30")).toISOString()); // duración 30 + preparación 10 cruza descanso
      expect(result).toContain(new Date(at("11:15")).toISOString());
      expect(result).toContain(new Date(at("13:00")).toISOString());
      const id = (
        await db.query<{ id: string }>(
          "select public.save_availability_exception($1,null,$2,$3,$3,840,900,'blocked','') id",
          [org, staff, day],
        )
      ).rows[0]!.id;
      expect(
        (await slots()).rows.map((row) =>
          new Date(row.starts_at).toISOString(),
        ),
      ).not.toContain(new Date(at("14:00")).toISOString());
      await db.query(
        "select public.remove_availability_entry($1,$2,'exception')",
        [org, id],
      );
      const vacation = (
        await db.query<{ id: string }>(
          "select public.save_availability_exception($1,null,null,$2,$2,null,null,'holiday','') id",
          [org, day],
        )
      ).rows[0]!.id;
      expect((await slots()).rows).toHaveLength(0);
      await db.query(
        "select public.remove_availability_entry($1,$2,'exception')",
        [org, vacation],
      );
    }));
  it("requiere ambos horarios, servicio activo y asignación del mismo tenant", async () =>
    runAs(db, accounts.owner, async () => {
      const bare = await saveProfessional(db, org, [service], {
        ...professionalData,
        name: "Sin horario",
      });
      expect((await slots(bare)).rows).toHaveLength(0);
      await expect(
        db.query("select * from public.get_available_slots($1,$2,$3,$4)", [
          foreign,
          service,
          staff,
          day,
        ]),
      ).rejects.toMatchObject({ code: "42501" });
      const unassigned = await saveService(db, org, [], {
        ...serviceData,
        name: "Sin asignación",
      });
      await expect(
        db.query("select * from public.get_available_slots($1,$2,$3,$4)", [
          org,
          unassigned,
          staff,
          day,
        ]),
      ).rejects.toMatchObject({ code: "22023" });
    }));
  it("revalida el slot en SQL, conserva precios históricos y deduplica reintentos", async () =>
    runAs(db, accounts.owner, async () => {
      const key = crypto.randomUUID();
      const id = await reserve("09:00", key);
      expect(await reserve("09:00", key)).toBe(id);
      await expect(reserve("09:15")).rejects.toMatchObject({ code: "23P01" });
      await expect(reserve("10:00", key)).rejects.toMatchObject({
        code: "22023",
      });
      const adjacent = await reserve("09:45");
      expect(adjacent).not.toBe(id);
      expect(await reserve("09:00", crypto.randomUUID(), second)).not.toBe(id);
      await saveService(
        db,
        org,
        [staff, second],
        {
          ...serviceData,
          name: "Nuevo nombre",
          price_minor: 999999,
          duration_minutes: 60,
        },
        service,
      );
      expect(
        (
          await db.query(
            "select service_name,price_minor,duration_minutes from public.appointments where id=$1",
            [id],
          )
        ).rows[0],
      ).toEqual({
        service_name: "Consulta",
        price_minor: 250050,
        duration_minutes: 30,
      });
      expect(
        (
          await db.query(
            "select count(*)::int n from public.appointment_history where appointment_id=$1",
            [id],
          )
        ).rows[0],
      ).toEqual({ n: 1 });
      await saveService(db, org, [staff, second], serviceData, service);
    }));
  it("la restricción GiST protege incluso frente a un INSERT administrativo que omita la RPC", async () => {
    const original = await runAs(db, accounts.owner, () => reserve("16:00"));
    await expect(
      db.query(
        `insert into public.appointments(organization_id,staff_id,service_id,customer_name,customer_email,customer_phone,service_name,staff_name,duration_minutes,preparation_minutes,price_minor,currency,timezone,starts_at,ends_at,occupied_until,status,request_key,request_hash,created_by)
   select organization_id,staff_id,service_id,customer_name,customer_email,customer_phone,service_name,staff_name,duration_minutes,preparation_minutes,price_minor,currency,timezone,starts_at,ends_at,occupied_until,status,gen_random_uuid(),request_hash,created_by from public.appointments where id=$1`,
        [original],
      ),
    ).rejects.toMatchObject({ code: "23P01" });
  });
  it("cancela sin borrar, libera el slot y bloquea transiciones inválidas o versiones viejas", async () =>
    runAs(db, accounts.owner, async () => {
      const id = await reserve("10:30");
      await expect(
        db.query(
          "select public.change_appointment_status($1,$2,1,'completed')",
          [org, id],
        ),
      ).rejects.toMatchObject({ code: "22023" });
      await db.query(
        "select public.change_appointment_status($1,$2,1,'confirmed')",
        [org, id],
      );
      await expect(
        db.query(
          "select public.change_appointment_status($1,$2,1,'canceled')",
          [org, id],
        ),
      ).rejects.toMatchObject({ code: "40001" });
      await expect(
        db.query(
          "select public.change_appointment_status($1,$2,2,'completed')",
          [org, id],
        ),
      ).rejects.toMatchObject({ code: "22023" });
      await expect(
        db.query("select public.change_appointment_status($1,$2,2,'no_show')", [
          org,
          id,
        ]),
      ).rejects.toMatchObject({ code: "22023" });
      await db.query(
        "select public.change_appointment_status($1,$2,2,'canceled')",
        [org, id],
      );
      await expect(
        db.query(
          "select public.change_appointment_status($1,$2,3,'confirmed')",
          [org, id],
        ),
      ).rejects.toMatchObject({ code: "22023" });
      expect(await reserve("10:30")).not.toBe(id);
      expect(
        (
          await db.query("select status from public.appointments where id=$1", [
            id,
          ])
        ).rows[0],
      ).toEqual({ status: "canceled" });
      expect(
        (
          await db.query(
            "select count(*)::int n from public.appointment_history where appointment_id=$1",
            [id],
          )
        ).rows[0],
      ).toEqual({ n: 3 });
    }));
  it("reprograma atómicamente, conserva condiciones y deja intacto el turno si falla", async () =>
    runAs(db, accounts.owner, async () => {
      const id = await reserve("15:00");
      await expect(
        db.query("select public.reschedule_appointment($1,$2,1,$3)", [
          org,
          id,
          at("16:00"),
        ]),
      ).rejects.toMatchObject({ code: "23P01" });
      expect(
        (
          await db.query(
            "select version from public.appointments where id=$1",
            [id],
          )
        ).rows[0],
      ).toEqual({ version: 1 });
      await saveService(
        db,
        org,
        [staff, second],
        { ...serviceData, duration_minutes: 60, price_minor: 900000 },
        service,
      );
      await db.query("select public.reschedule_appointment($1,$2,1,$3)", [
        org,
        id,
        at("17:00"),
      ]);
      expect(
        (
          await db.query(
            "select version,duration_minutes,price_minor from public.appointments where id=$1",
            [id],
          )
        ).rows[0],
      ).toEqual({ version: 2, duration_minutes: 30, price_minor: 250050 });
      await expect(
        db.query("select public.reschedule_appointment($1,$2,1,$3)", [
          org,
          id,
          at("18:00"),
        ]),
      ).rejects.toMatchObject({ code: "40001" });
      await saveService(db, org, [staff, second], serviceData, service);
    }));
  it("aplica anticipación mínima/máxima y no acepta segundos ni horarios fuera de cuadrícula", async () =>
    runAs(db, accounts.owner, async () => {
      await expect(reserve("18:07")).rejects.toMatchObject({ code: "23P01" });
      await db.query("select public.save_booking_settings($1,0,1)", [org]);
      expect((await slots()).rows).toHaveLength(0);
      await expect(reserve("18:00")).rejects.toMatchObject({ code: "23P01" });
      await db.query("select public.save_booking_settings($1,14400,365)", [
        org,
      ]);
      expect((await slots()).rows).toHaveLength(0);
      await db.query("select public.save_booking_settings($1,0,365)", [org]);
    }));
  it("aísla calendario, detalles e historial; staff solo ve y modifica su propia agenda", async () => {
    await db.query(
      "insert into public.organization_members(organization_id,user_id,role) values($1,$2,'staff')",
      [org, accounts.staff],
    );
    await runAs(db, accounts.owner, () =>
      saveProfessional(
        db,
        org,
        [service],
        { ...professionalData, user_id: accounts.staff },
        staff,
      ),
    );
    await runAs(db, accounts.staff, async () => {
      expect(
        (
          await db.query<{ staff_id: string }>(
            "select * from public.get_appointment_calendar($1,$2,7)",
            [org, day],
          )
        ).rows.every((row) => row.staff_id === staff),
      ).toBe(true);
      const id = await reserve("18:00");
      expect(id).toBeTruthy();
      await expect(
        reserve("18:00", crypto.randomUUID(), second),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        db.query("select public.save_booking_settings($1,0,2)", [org]),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        db.query(
          "update public.appointments set status='completed' where id=$1",
          [id],
        ),
      ).rejects.toMatchObject({ code: "42501" });
    });
    await runAs(db, accounts.other, async () => {
      expect(
        (
          await db.query(
            "select * from public.appointments where organization_id=$1",
            [org],
          )
        ).rows,
      ).toHaveLength(0);
      expect(
        (
          await db.query(
            "select * from public.appointment_history where organization_id=$1",
            [org],
          )
        ).rows,
      ).toHaveLength(0);
      await expect(
        db.query("select * from public.get_appointment_calendar($1,$2,1)", [
          org,
          day,
        ]),
      ).rejects.toMatchObject({ code: "42501" });
    });
    await runAs(
      db,
      null,
      async () => {
        await expect(
          db.query("select * from public.appointments"),
        ).rejects.toMatchObject({ code: "42501" });
      },
      "anon",
    );
  });
  it("completa un servicio terminado y conserva historial inmutable y estado final", async () => {
    const id = await runAs(db, accounts.owner, () => reserve("19:00"));
    // Fixture administrativo de una cita pasada: la API nunca permite crear turnos en el pasado.
    await db.query(
      "update public.appointments set starts_at=now()-interval '2 hours',ends_at=now()-interval '90 minutes',occupied_until=now()-interval '80 minutes' where id=$1",
      [id],
    );
    await runAs(db, accounts.owner, async () => {
      await db.query(
        "select public.change_appointment_status($1,$2,1,'confirmed')",
        [org, id],
      );
      await db.query(
        "select public.change_appointment_status($1,$2,2,'completed')",
        [org, id],
      );
      await expect(
        db.query(
          "select public.change_appointment_status($1,$2,3,'canceled')",
          [org, id],
        ),
      ).rejects.toMatchObject({ code: "22023" });
      await expect(
        db.query(
          "delete from public.appointment_history where appointment_id=$1",
          [id],
        ),
      ).rejects.toMatchObject({ code: "42501" });
      expect(
        (
          await db.query(
            "select status,version from public.appointments where id=$1",
            [id],
          )
        ).rows[0],
      ).toEqual({ status: "completed", version: 3 });
    });
  });
  it("registra ausencia después del comienzo y rechaza reprogramar estados finales", async () => {
    const id = await runAs(db, accounts.owner, () => reserve("20:00"));
    await db.query(
      "update public.appointments set starts_at=now()-interval '1 minute',ends_at=now()+interval '29 minutes',occupied_until=now()+interval '39 minutes' where id=$1",
      [id],
    );
    await runAs(db, accounts.owner, async () => {
      await db.query(
        "select public.change_appointment_status($1,$2,1,'confirmed')",
        [org, id],
      );
      await db.query(
        "select public.change_appointment_status($1,$2,2,'no_show')",
        [org, id],
      );
      await expect(
        db.query("select public.reschedule_appointment($1,$2,3,$3)", [
          org,
          id,
          at("21:00"),
        ]),
      ).rejects.toMatchObject({ code: "22023" });
      expect(
        (
          await db.query("select status from public.appointments where id=$1", [
            id,
          ])
        ).rows[0],
      ).toEqual({ status: "no_show" });
    });
  });
  it("maneja cambios DST sin inventar horas y distingue la hora repetida por su instante UTC", async () =>
    runAs(db, accounts.owner, async () => {
      await db.query(
        "update public.organizations set timezone='America/New_York' where id=$1",
        [org],
      );
      const nextSunday = (month: number, week: number) => {
        let year = new Date().getUTCFullYear();
        const occurrence = () => {
          const date = new Date(Date.UTC(year, month, 1));
          date.setUTCDate(1 + ((7 - date.getUTCDay()) % 7) + (week - 1) * 7);
          return date;
        };
        if (occurrence() <= new Date()) year++;
        return occurrence().toISOString().slice(0, 10);
      };
      const springDay = nextSunday(2, 2),
        fallDay = nextSunday(10, 1);
      const spring = (await slots(second, springDay)).rows.map((row) =>
        new Date(row.starts_at).toISOString(),
      );
      expect(spring).not.toContain(`${springDay}T06:30:00.000Z`); // 01:30 + 40 cruza salto
      expect(spring).toContain(`${springDay}T07:00:00.000Z`); // 03:00 local
      const fall = (await slots(second, fallDay)).rows.map((row) =>
        new Date(row.starts_at).toISOString(),
      );
      expect(fall).toContain(`${fallDay}T05:00:00.000Z`);
      expect(fall).toContain(`${fallDay}T06:00:00.000Z`);
      await db.query(
        "update public.organizations set timezone='America/Argentina/Buenos_Aires' where id=$1",
        [org],
      );
    }));
});
