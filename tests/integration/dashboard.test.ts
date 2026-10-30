import { beforeAll, afterAll, it, expect } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import {
  accounts,
  createTestDatabase,
  createOrganization,
  runAs,
  saveProfessional,
  saveService,
} from "../helpers/database";
import { dashboardSchema } from "@/features/dashboard/schema";
let db: PGlite, org: string, other: string, staff: string, service: string;
async function read(
  from = "2026-10-01",
  to = "2026-10-31",
  tenant = org,
  actor = accounts.owner,
) {
  return runAs(db, actor, async () =>
    dashboardSchema.parse(
      (
        await db.query<{ v: unknown }>(
          "select public.get_business_dashboard($1,$2,$3) v",
          [tenant, from, to],
        )
      ).rows[0]!.v,
    ),
  );
}
async function insert(
  starts: string,
  status: string,
  email = "cliente@example.test",
  tenant = org,
  profile = staff,
  svc = service,
) {
  return (
    await db.query<{ id: string }>(
      `insert into public.appointments(organization_id,staff_id,service_id,customer_name,customer_email,customer_phone,service_name,staff_name,duration_minutes,preparation_minutes,price_minor,currency,timezone,starts_at,ends_at,occupied_until,status,request_key,request_hash,created_by)
    values($1,$2,$3,'Cliente',$4,'privado','Servicio histórico','Profesional',30,0,1234,'ARS','America/Argentina/Buenos_Aires',$5::timestamptz,$5::timestamptz+interval '30 minutes',$5::timestamptz+interval '30 minutes',$6,gen_random_uuid(),'fixture',$7) returning id`,
      [tenant, profile, svc, email, starts, status, accounts.owner],
    )
  ).rows[0]!.id;
}
beforeAll(async () => {
  db = await createTestDatabase("20261023001100");
  org = await createOrganization(db, accounts.owner, "resumen");
  other = await createOrganization(db, accounts.other, "otro-resumen");
  await runAs(db, accounts.owner, async () => {
    staff = await saveProfessional(db, org);
    service = await saveService(db, org, [staff]);
  });
  await db.query(
    "insert into public.organization_members(organization_id,user_id,role) values($1,$2,'staff')",
    [org, accounts.staff],
  );
});
afterAll(async () => {
  await db?.close();
});
it("devuelve ceros reales y una serie diaria completa sin datos ficticios", async () => {
  const data = await read();
  expect(data.counts.total).toBe(0);
  expect(data.customers).toEqual({ attended: 0, recurring: 0 });
  expect(data.services).toEqual([]);
  expect(data.series).toHaveLength(31);
  expect(data.series.every((d) => d.total === 0)).toBe(true);
});
it("deniega staff, otros tenants, administrador sin membresía, anónimo y cuenta sin confirmar", async () => {
  for (const [tenant, actor] of [
    [org, accounts.staff],
    [other, accounts.owner],
    [org, accounts.stranger],
  ])
    await expect(read(undefined, undefined, tenant!, actor!)).rejects.toThrow(
      /Forbidden/,
    );
  await db.query("insert into private.platform_admins(user_id) values($1)", [
    accounts.stranger,
  ]);
  await expect(
    read(undefined, undefined, org, accounts.stranger),
  ).rejects.toThrow(/Forbidden/);
  await expect(
    runAs(
      db,
      null,
      () =>
        db.query(
          "select public.get_business_dashboard($1,'2026-10-01','2026-10-31')",
          [org],
        ),
      "anon",
    ),
  ).rejects.toThrow(/permission denied/);
  await db.query("update auth.users set email_confirmed_at=null where id=$1", [
    accounts.owner,
  ]);
  await expect(read()).rejects.toThrow(/Forbidden/);
  await db.query("update auth.users set email_confirmed_at=now() where id=$1", [
    accounts.owner,
  ]);
});
it("valida rango inclusivo y máximo de 93 días también en SQL", async () => {
  for (const [from, to] of [
    ["2026-02-02", "2026-02-01"],
    ["2026-01-01", "2026-04-04"],
    ["1999-01-01", "1999-01-01"],
    ["2026-01-01", "infinity"],
  ])
    await expect(read(from, to)).rejects.toThrow(/Invalid reporting period/);
  expect((await read("2026-01-01", "2026-04-03")).series).toHaveLength(93);
  expect((await read("2026-02-01", "2026-02-01")).series).toHaveLength(1);
});
it("agrupa por inicio local, conserva todos los estados y cuenta clientes recurrentes por completados", async () => {
  await insert("2026-10-01T02:00:00Z", "completed"); // 30/9 local: excluido.
  await insert("2026-10-01T03:00:00Z", "completed");
  await insert("2026-10-02T03:00:00Z", "completed");
  await insert("2026-10-03T03:00:00Z", "completed", "otro@example.test");
  await insert("2026-10-04T03:00:00Z", "canceled");
  await insert("2026-10-05T03:00:00Z", "no_show");
  await insert("2026-10-06T03:00:00Z", "pending");
  await insert("2026-10-07T03:00:00Z", "confirmed");
  await insert("2026-11-01T03:00:00Z", "completed"); // límite superior: excluido.
  const data = await read();
  expect(data.counts).toEqual({
    total: 7,
    completed: 3,
    canceled: 1,
    no_show: 1,
    pending: 1,
    confirmed: 1,
  });
  expect(data.customers).toEqual({ attended: 2, recurring: 1 });
  expect(data.series.reduce((n, d) => n + d.total, 0)).toBe(7);
  expect(data.series[0]!.total).toBe(1);
  expect(data.services[0]).toMatchObject({ total: 7, completed: 3 });
  expect(JSON.stringify(data)).not.toContain("cliente@example.test");
  expect(JSON.stringify(data)).not.toContain("privado");
  expect(JSON.stringify(data)).not.toContain("price_minor");
});
it("mantiene historia con servicios inactivos y suscripción vencida sin habilitar analítica avanzada", async () => {
  await db.query("update public.services set is_active=false where id=$1", [
    service,
  ]);
  await db.query(
    "update public.organization_subscriptions set ends_at=now()-interval '1 hour',starts_at=now()-interval '2 days' where organization_id=$1",
    [org],
  );
  expect((await read()).counts.total).toBe(7);
  expect((await read()).services[0]!.total).toBe(7);
  await db.query(
    "update public.organization_subscriptions set starts_at=now(),ends_at=now()+interval '30 days' where organization_id=$1",
    [org],
  );
  await db.query("update public.services set is_active=true where id=$1", [
    service,
  ]);
  expect(
    (
      await db.query<{ v: boolean }>(
        "select private.has_module($1,'analytics') v",
        [org],
      )
    ).rows[0]!.v,
  ).toBe(false);
});
it("respeta días de 23 y 25 horas con cambios DST", async () => {
  await db.query(
    "update public.organizations set timezone='America/New_York' where id=$1",
    [org],
  );
  for (const instant of [
    "2026-03-08T04:00:00Z",
    "2026-03-08T05:00:00Z",
    "2026-03-09T03:00:00Z",
    "2026-03-09T04:00:00Z",
  ])
    await insert(instant, "completed");
  expect((await read("2026-03-08", "2026-03-08")).counts.total).toBe(2);
  for (const instant of [
    "2026-11-01T04:00:00Z",
    "2026-11-01T05:00:00Z",
    "2026-11-01T06:00:00Z",
    "2026-11-02T05:00:00Z",
  ])
    await insert(instant, "completed");
  expect((await read("2026-11-01", "2026-11-01")).counts.total).toBe(3);
  await db.query(
    "update public.organizations set timezone='America/Argentina/Buenos_Aires' where id=$1",
    [org],
  );
});
it("resume más de mil reservas sin truncado y no mezcla otro negocio", async () => {
  await db.query(
    `insert into public.appointments(organization_id,staff_id,service_id,customer_name,customer_email,service_name,staff_name,duration_minutes,preparation_minutes,price_minor,currency,timezone,starts_at,ends_at,occupied_until,status,request_key,request_hash,created_by)
    select $1,$2,$3,'Masivo','masivo@example.test','Servicio','Profesional',30,0,100,'ARS','America/Argentina/Buenos_Aires',t,t+interval '30 minutes',t+interval '30 minutes','completed',gen_random_uuid(),'fixture',$4 from generate_series('2026-05-01 03:00Z'::timestamptz,'2026-05-01 03:00Z'::timestamptz+1004*interval '1 hour',interval '1 hour') t`,
    [org, staff, service, accounts.owner],
  );
  expect((await read("2026-05-01", "2026-06-30")).counts.completed).toBe(1005);
  expect(
    (await read("2026-05-01", "2026-06-30", other, accounts.other)).counts
      .total,
  ).toBe(0);
});
it("limita próximas reservas y actividad, usa hora actual y aplica revocación de acceso", async () => {
  const future = new Date(Date.now() + 86400000).toISOString();
  const id = await insert(future, "confirmed");
  await db.query(
    "insert into public.appointment_history(organization_id,appointment_id,actor_id,event,to_status,new_starts_at) select $1,$2,$3,'created','confirmed',$4::timestamptz from generate_series(1,12)",
    [org, id, accounts.owner, future],
  );
  const data = await read();
  expect(data.upcoming.length).toBeLessThanOrEqual(5);
  expect(data.upcoming.some((a) => a.id === id)).toBe(true);
  expect(data.activity).toHaveLength(10);
  await db.query(
    "update public.organization_members set is_active=false where organization_id=$1 and user_id=$2",
    [org, accounts.owner],
  );
  await expect(read()).rejects.toThrow(/Forbidden/);
});
