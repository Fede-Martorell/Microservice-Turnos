import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import {
  accounts,
  createTestDatabase,
  createOrganization,
  runAs,
  saveService,
  saveProfessional,
} from "../helpers/database";
let db: PGlite,
  org: string,
  otherOrg: string,
  staff: string,
  service: string,
  customer: string,
  original: string;
const secret = "a".repeat(64);
async function rpc<T = unknown>(name: string, args: unknown[]) {
  const call = `public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")})`;
  return (
    await db.query<{ value: T }>(
      name === "get_customer_directory"
        ? `select coalesce(jsonb_agg(row),'[]') value from ${call} row`
        : `select ${call} value`,
      args,
    )
  ).rows[0]!.value;
}
async function worker<T>(fn: () => Promise<T>, key = secret) {
  return runAs(
    db,
    null,
    async () => {
      await db.query("select set_config('request.headers',$1,false)", [
        JSON.stringify({ "x-notification-worker-secret": key }),
      ]);
      try {
        return await fn();
      } finally {
        await db.exec("reset request.headers");
      }
    },
    "anon",
  );
}
async function appointment(
  email = "cliente@example.test",
  hour = 10,
  orgId = org,
  profile = staff,
  svc = service,
  status = "confirmed",
) {
  return (
    await db.query<{ id: string }>(
      `insert into public.appointments(organization_id,staff_id,service_id,customer_name,customer_email,customer_phone,service_name,staff_name,duration_minutes,preparation_minutes,price_minor,currency,timezone,starts_at,ends_at,occupied_until,status,request_key,request_hash,created_by)
 values($1,$2,$3,'Cliente histórico',$4,'111','Consulta','Profesional',30,0,3000,'ARS','America/Argentina/Buenos_Aires',date_trunc('day',now())+interval '7 days'+$5*interval '1 hour',date_trunc('day',now())+interval '7 days'+($5*60+30)*interval '1 minute',date_trunc('day',now())+interval '7 days'+($5*60+30)*interval '1 minute',$6,gen_random_uuid(),'test',$7) returning id`,
      [orgId, profile, svc, email, hour, status, accounts.owner],
    )
  ).rows[0]!.id;
}
type Job = {
  id: string;
  claim_token: string;
  kind: string;
  snapshot: { customer_email: string };
  message: unknown;
};
const message = {
  from: "Reservas <onboarding@resend.dev>",
  to: "queue@example.test",
  subject: "Confirmada",
  text: "Texto",
  html: "<p>Texto</p>",
};
beforeAll(async () => {
  db = await createTestDatabase("20261021000500");
  org = await createOrganization(db, accounts.owner, "clientes");
  otherOrg = await createOrganization(db, accounts.other, "otrosclientes");
  await db.query(
    "insert into public.organization_members(organization_id,user_id,role,is_active) values($1,$2,'staff',true)",
    [org, accounts.staff],
  );
  await runAs(db, accounts.owner, async () => {
    staff = await saveProfessional(db, org, [], {
      name: "Profesional",
      description: "",
      user_id: accounts.staff,
      photo_url: "",
      is_active: true,
    });
    service = await saveService(db, org, [staff]);
  });
  original = await appointment("CLIENTE@example.test");
  await appointment("cliente@example.test", 11);
  await db.exec(
    await readFile(
      new URL(
        "../../supabase/migrations/20261021000600_customers_and_notifications.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  customer = (
    await db.query<{ id: string }>(
      "select id from public.customers where organization_id=$1",
      [org],
    )
  ).rows[0]!.id;
  await db.exec(
    await readFile(
      new URL(
        "../../supabase/migrations/20261021000700_customer_preference_access.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.query(
    "insert into private.notification_worker(secret_hash) values(encode(sha256(convert_to($1,'UTF8')),'hex'))",
    [secret],
  );
});
afterAll(async () => {
  await db?.close();
});
describe("clientes por tenant, historial y preferencias", () => {
  it("migra historial sin duplicar emails normalizados ni generar avisos retroactivos", async () => {
    expect(
      (await db.query("select * from public.customers")).rows,
    ).toHaveLength(1);
    expect(
      (
        await db.query(
          "select * from public.appointments where customer_id=$1",
          [customer],
        )
      ).rows,
    ).toHaveLength(2);
    expect(
      (await db.query("select * from public.notification_jobs")).rows,
    ).toHaveLength(0);
  });
  it("no sobrescribe la ficha con datos de nuevas reservas y no comparte clientes", async () => {
    await db.query(
      "update public.customers set name='Nombre corregido' where id=$1",
      [customer],
    );
    const id = await appointment("cliente@example.test", 12);
    expect(
      (
        await db.query<{ customer_id: string }>(
          "select customer_id from public.appointments where id=$1",
          [id],
        )
      ).rows[0]?.customer_id,
    ).toBe(customer);
    expect(
      (
        await db.query<{ name: string }>(
          "select name from public.customers where id=$1",
          [customer],
        )
      ).rows[0]?.name,
    ).toBe("Nombre corregido");
    const other = await runAs(db, accounts.other, () =>
      rpc<string>("save_customer", [
        otherOrg,
        null,
        null,
        {
          name: "Otro cliente",
          email: "cliente@example.test",
          phone: "",
          is_active: true,
        },
      ]),
    );
    expect(other).not.toBe(customer);
    await runAs(db, accounts.other, async () => {
      expect(
        (
          await db.query("select id from public.customers where id=$1", [
            customer,
          ])
        ).rows,
      ).toHaveLength(0);
    });
  });
  it("staff solo ve clientes e historial de su agenda; no modifica fichas ni preferencias", async () => {
    await runAs(db, accounts.owner, () =>
      rpc("save_customer", [
        org,
        null,
        null,
        {
          name: "Sin turno",
          email: "privado@example.test",
          phone: "",
          is_active: true,
        },
      ]),
    );
    await runAs(db, accounts.staff, async () => {
      const rows = await rpc<{ id: string }[]>("get_customer_directory", [
        org,
        "",
        "all",
        "all",
        0,
      ]);
      expect(rows.map((r) => r.id)).toContain(customer);
      expect(rows).toHaveLength(1);
      await expect(
        db.query("select consent_evidence from public.customers where id=$1", [
          customer,
        ]),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        rpc("get_customer_preferences", [org, customer]),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        rpc("save_customer_preferences", [org, customer, 1, false, false, ""]),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        db.query(
          "update public.customers set marketing_consent=true where id=$1",
          [customer],
        ),
      ).rejects.toMatchObject({ code: "42501" });
    });
  });
  it("actualiza con versión y evidencia de consentimiento, conserva snapshots y audita", async () => {
    await runAs(db, accounts.owner, async () => {
      await rpc("save_customer", [
        org,
        customer,
        1,
        {
          name: "Cliente editado",
          email: "cliente@example.test",
          phone: "222",
          is_active: true,
        },
      ]);
      await expect(
        rpc("save_customer", [
          org,
          customer,
          1,
          {
            name: "Versión vieja",
            email: "cliente@example.test",
            phone: "",
            is_active: true,
          },
        ]),
      ).rejects.toMatchObject({ code: "40001" });
      await expect(
        rpc("save_customer_preferences", [org, customer, 2, true, true, ""]),
      ).rejects.toMatchObject({ code: "22023" });
      await rpc("save_customer_preferences", [
        org,
        customer,
        2,
        true,
        true,
        "Solicitud expresa registrada por el negocio",
      ]);
      expect(
        await rpc("get_customer_preferences", [org, customer]),
      ).toMatchObject({ marketing_consent: true });
    });
    expect(
      (
        await db.query(
          "select customer_name,customer_phone from public.appointments where id=$1",
          [original],
        )
      ).rows[0],
    ).toEqual({ customer_name: "Cliente histórico", customer_phone: "111" });
    expect(
      (
        await db.query(
          "select * from private.customer_consent_events where customer_id=$1",
          [customer],
        )
      ).rows,
    ).toHaveLength(1);
  });
  it("calcula visitas completadas y recurrencia solo desde filas autorizadas", async () => {
    await db.query(
      "update public.appointments set status='completed' where organization_id=$1 and customer_id=$2",
      [org, customer],
    );
    const rows = await runAs(db, accounts.owner, () =>
      rpc<{ completed_visits: number; total_reservations: number }[]>(
        "get_customer_directory",
        [org, "editado", "active", "recurrent", 0],
      ),
    );
    expect(Number(rows[0]?.completed_visits)).toBe(3);
    expect(Number(rows[0]?.total_reservations)).toBe(3);
    const unlinkedStaff = await runAs(db, accounts.owner, () =>
      saveProfessional(db, org, [], {
        name: "Otra agenda",
        description: "",
        user_id: "",
        photo_url: "",
        is_active: true,
      }),
    );
    await appointment(
      "cliente@example.test",
      10,
      org,
      unlinkedStaff,
      service,
      "completed",
    );
    const ownRows = await runAs(db, accounts.staff, () =>
      rpc<{ completed_visits: number }[]>("get_customer_directory", [
        org,
        "editado",
        "all",
        "all",
        0,
      ]),
    );
    expect(Number(ownRows[0]?.completed_visits)).toBe(3);
    const ownerRows = await runAs(db, accounts.owner, () =>
      rpc<{ completed_visits: number }[]>("get_customer_directory", [
        org,
        "editado",
        "all",
        "all",
        0,
      ]),
    );
    expect(Number(ownerRows[0]?.completed_visits)).toBe(4);
    await runAs(
      db,
      null,
      async () => {
        await expect(
          db.query("select * from public.customers"),
        ).rejects.toMatchObject({ code: "42501" });
      },
      "anon",
    );
  });
});
describe("outbox, recordatorios y entregas persistentes", () => {
  let booking: string, job: Job;
  it("crea avisos y recordatorios en la misma transacción, sin duplicar", async () => {
    await runAs(db, accounts.owner, () =>
      rpc("save_notification_settings", [org, true, true, 1440]),
    );
    booking = await appointment("queue@example.test", 13);
    const jobs = (
      await db.query(
        "select kind,status from public.notification_jobs where appointment_id=$1 order by kind",
        [booking],
      )
    ).rows;
    expect(jobs).toEqual([
      { kind: "created", status: "queued" },
      { kind: "reminder", status: "queued" },
    ]);
    await db.query(
      "update public.appointments set version=version where id=$1",
      [booking],
    );
    expect(
      (
        await db.query(
          "select * from public.notification_jobs where appointment_id=$1",
          [booking],
        )
      ).rows,
    ).toHaveLength(2);
  });
  it("anon no lee cola/payload y las RPC requieren un secreto específico", async () => {
    await expect(
      worker(() => rpc("claim_notification_jobs", [5, null]), ""),
    ).rejects.toMatchObject({ code: "42501" });
    await runAs(
      db,
      null,
      async () => {
        await expect(
          db.query("select * from private.notification_payloads"),
        ).rejects.toMatchObject({ code: "42501" });
        await expect(
          db.query("select * from public.notification_jobs"),
        ).rejects.toMatchObject({ code: "42501" });
      },
      "anon",
    );
    await runAs(db, accounts.staff, async () => {
      expect(
        (await db.query("select * from public.notification_jobs")).rows,
      ).toHaveLength(0);
    });
  });
  it("filtra pruebas por destinatario, toma lease y evita reclamar un trabajo activo", async () => {
    expect(
      await worker(() =>
        rpc("claim_notification_jobs", [5, "ajeno@example.test"]),
      ),
    ).toEqual([]);
    const jobs = await worker(() =>
      rpc<Job[]>("claim_notification_jobs", [5, "queue@example.test"]),
    );
    expect(jobs).toHaveLength(1);
    job = jobs[0]!;
    expect(
      await worker(() =>
        rpc("claim_notification_jobs", [5, "queue@example.test"]),
      ),
    ).toEqual([]);
  });
  it("congela el contenido antes del proveedor y respeta token de lease en resultados", async () => {
    const prepared = await worker(() =>
      rpc("prepare_notification_delivery", [job.id, job.claim_token, message]),
    );
    expect(prepared).toEqual(message);
    expect(
      await worker(() =>
        rpc("finish_notification_job", [
          job.id,
          crypto.randomUUID(),
          "sent",
          "id_1",
          null,
        ]),
      ),
    ).toBe(false);
    expect(
      await worker(() =>
        rpc("finish_notification_job", [
          job.id,
          job.claim_token,
          "retry",
          null,
          "network_error",
        ]),
      ),
    ).toBe(true);
    const saved = (
      await db.query(
        "select status,attempts,scheduled_at>now() later from public.notification_jobs where id=$1",
        [job.id],
      )
    ).rows[0];
    expect(saved).toMatchObject({ status: "retry", attempts: 1, later: true });
  });
  it("reintenta con el mismo cuerpo y finaliza sin volver a tomar el envío aceptado", async () => {
    await db.query(
      "update public.notification_jobs set scheduled_at=now()-interval '1 minute' where id=$1",
      [job.id],
    );
    const jobs = await worker(() =>
      rpc<Job[]>("claim_notification_jobs", [5, "queue@example.test"]),
    );
    job = jobs[0]!;
    expect(job.message).toEqual(message);
    expect(
      await worker(() =>
        rpc("prepare_notification_delivery", [
          job.id,
          job.claim_token,
          { ...message, subject: "No cambiar" },
        ]),
      ),
    ).toEqual(message);
    expect(
      await worker(() =>
        rpc("finish_notification_job", [
          job.id,
          job.claim_token,
          "sent",
          "id_1",
          null,
        ]),
      ),
    ).toBe(true);
    expect(
      await worker(() =>
        rpc("claim_notification_jobs", [5, "queue@example.test"]),
      ),
    ).toEqual([]);
  });
  it("reprogramar invalida avisos viejos y agenda un recordatorio nuevo; cancelar lo omite", async () => {
    await db.query(
      "update public.appointments set starts_at=starts_at+interval '1 day',ends_at=ends_at+interval '1 day',occupied_until=occupied_until+interval '1 day',version=version+1 where id=$1",
      [booking],
    );
    await db.query(
      "update public.notification_jobs set scheduled_at=now()-interval '1 minute' where appointment_id=$1 and kind='reminder'",
      [booking],
    );
    let jobs = await worker(() =>
      rpc<Job[]>("claim_notification_jobs", [10, "queue@example.test"]),
    );
    expect(jobs.map((j) => j.kind)).toContain("rescheduled");
    expect(
      (
        await db.query<{ status: string }>(
          "select status from public.notification_jobs where appointment_id=$1 and appointment_version=1 and kind='reminder'",
          [booking],
        )
      ).rows[0]?.status,
    ).toBe("skipped");
    await db.query(
      "update public.appointments set status='canceled',version=version+1 where id=$1",
      [booking],
    );
    for (const item of jobs)
      expect(
        await worker(() =>
          rpc("prepare_notification_delivery", [
            item.id,
            item.claim_token,
            message,
          ]),
        ),
      ).toBeNull();
    jobs = await worker(() =>
      rpc<Job[]>("claim_notification_jobs", [10, "queue@example.test"]),
    );
    expect(jobs.map((j) => j.kind)).toEqual(["canceled"]);
  });
  it("respeta preferencias actuales y suspensiones al entregar, incluso tras reclamar", async () => {
    const id = await appointment("optout@example.test", 15);
    const jobs = await worker(() =>
      rpc<Job[]>("claim_notification_jobs", [5, "optout@example.test"]),
    );
    await db.query(
      "update public.customers set transactional_email=false where email='optout@example.test'",
    );
    expect(
      await worker(() =>
        rpc("prepare_notification_delivery", [
          jobs[0]!.id,
          jobs[0]!.claim_token,
          { ...message, to: "optout@example.test" },
        ]),
      ),
    ).toBeNull();
    expect(
      (
        await db.query<{ status: string }>(
          "select status from public.notification_jobs where appointment_id=$1 and kind='created'",
          [id],
        )
      ).rows[0]?.status,
    ).toBe("skipped");
  });
  it("recupera un lease vencido y cierra la ventana de reintentos antes de 24 horas", async () => {
    await appointment("timeout@example.test", 16);
    let jobs = await worker(() =>
      rpc<Job[]>("claim_notification_jobs", [5, "timeout@example.test"]),
    );
    const first = jobs[0]!;
    await worker(() =>
      rpc("prepare_notification_delivery", [
        first.id,
        first.claim_token,
        { ...message, to: "timeout@example.test" },
      ]),
    );
    await db.query(
      "update public.notification_jobs set lease_until=now()-interval '1 minute' where id=$1",
      [first.id],
    );
    jobs = await worker(() =>
      rpc<Job[]>("claim_notification_jobs", [5, "timeout@example.test"]),
    );
    expect(jobs[0]?.claim_token).not.toBe(first.claim_token);
    await db.query(
      "update public.notification_jobs set lease_until=now()-interval '1 minute',first_attempt_at=now()-interval '23 hours' where id=$1",
      [first.id],
    );
    expect(
      await worker(() =>
        rpc("claim_notification_jobs", [5, "timeout@example.test"]),
      ),
    ).toEqual([]);
    expect(
      (
        await db.query(
          "select status,last_error from public.notification_jobs where id=$1",
          [first.id],
        )
      ).rows[0],
    ).toEqual({ status: "failed", last_error: "retry_window_closed" });
  });
  it("una excepción en la transacción no deja una reserva, cliente o aviso parcial", async () => {
    await db.exec("begin");
    await appointment("rollback@example.test", 17);
    await db.exec("rollback");
    expect(
      (
        await db.query(
          "select * from public.customers where email='rollback@example.test'",
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          "select * from private.notification_payloads where snapshot->>'customer_email'='rollback@example.test'",
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("deshabilitar y habilitar no reproduce avisos previos ni genera confirmaciones históricas", async () => {
    const id = await appointment("disabled@example.test", 18);
    await runAs(db, accounts.owner, () =>
      rpc("save_notification_settings", [org, false, true, 1440]),
    );
    await runAs(db, accounts.owner, () =>
      rpc("save_notification_settings", [org, true, true, 1440]),
    );
    expect(
      (
        await db.query<{ status: string }>(
          "select status from public.notification_jobs where appointment_id=$1 and kind='created'",
          [id],
        )
      ).rows[0]?.status,
    ).toBe("skipped");
  });
  it("suspender el negocio bloquea la entrega y el acceso a clientes", async () => {
    await appointment("suspended@example.test", 19);
    await db.query(
      "update public.organizations set status='suspended' where id=$1",
      [org],
    );
    expect(
      await worker(() =>
        rpc("claim_notification_jobs", [5, "suspended@example.test"]),
      ),
    ).toEqual([]);
    await runAs(db, accounts.staff, async () => {
      expect(
        (
          await db.query(
            "select id from public.customers where organization_id=$1",
            [org],
          )
        ).rows,
      ).toHaveLength(0);
    });
    await db.query(
      "update public.organizations set status='active' where id=$1",
      [org],
    );
  });
});
