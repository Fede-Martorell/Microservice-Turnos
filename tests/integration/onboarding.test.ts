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
import { onboardingSchema } from "@/features/onboarding/schema";
let db: PGlite, org: string, other: string, staff: string, service: string;
async function read(tenant = org, actor = accounts.owner) {
  return runAs(db, actor, async () =>
    onboardingSchema.parse(
      (
        await db.query<{ v: unknown }>(
          "select public.get_business_onboarding($1) v",
          [tenant],
        )
      ).rows[0]!.v,
    ),
  );
}
async function hours(
  profile: string | null,
  start: number,
  end: number,
  kind = "working",
  day = 1,
) {
  await db.query(
    "insert into public.availability_rules(organization_id,staff_id,weekday,kind,start_minute,end_minute) values($1,$2,$3,$4,$5,$6)",
    [org, profile, day, kind, start, end],
  );
}
beforeAll(async () => {
  db = await createTestDatabase("20261030001200");
  org = await createOrganization(db, accounts.owner, "onboarding");
  other = await createOrganization(db, accounts.other, "otro-onboarding");
  await db.query(
    "insert into public.organization_members(organization_id,user_id,role) values($1,$2,'staff')",
    [org, accounts.staff],
  );
});
afterAll(async () => {
  await db?.close();
});
it("deriva los pasos de datos reales y devuelve solo booleanos", async () => {
  expect(await read()).toEqual({
    professional_ready: false,
    service_ready: false,
    business_hours_ready: false,
    matching_hours_ready: false,
    booking_recorded: false,
    public_enabled: false,
  });
  await runAs(db, accounts.owner, async () => {
    staff = await saveProfessional(db, org);
    service = await saveService(db, org, [staff]);
  });
  expect(await read()).toMatchObject({
    professional_ready: true,
    service_ready: true,
    business_hours_ready: false,
    matching_hours_ready: false,
  });
});
it("deniega staff, otros negocios, administrador sin membresía, anónimo y cuenta sin confirmar", async () => {
  await db.query("insert into private.platform_admins(user_id) values($1)", [
    accounts.stranger,
  ]);
  for (const [tenant, actor] of [
    [org, accounts.staff],
    [other, accounts.owner],
    [org, accounts.stranger],
  ])
    await expect(read(tenant!, actor!)).rejects.toThrow(/Forbidden/);
  await expect(
    runAs(
      db,
      null,
      () => db.query("select public.get_business_onboarding($1)", [org]),
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
it("requiere horarios de negocio, mismo día y duración más preparación; combina tramos adyacentes", async () => {
  await hours(staff, 540, 660);
  expect((await read()).matching_hours_ready).toBe(false);
  await hours(null, 540, 660, "working", 2);
  expect(await read()).toMatchObject({
    business_hours_ready: true,
    matching_hours_ready: false,
  });
  await hours(null, 540, 560);
  expect((await read()).matching_hours_ready).toBe(false); // Servicio 30 + preparación 10.
  await hours(null, 560, 580);
  expect((await read()).matching_hours_ready).toBe(true);
  await hours(null, 555, 565, "break");
  expect((await read()).matching_hours_ready).toBe(false);
  await db.query(
    "delete from public.availability_rules where organization_id=$1 and kind='break'",
    [org],
  );
  await hours(staff, 555, 565, "break");
  expect((await read()).matching_hours_ready).toBe(false);
  await db.query(
    "delete from public.availability_rules where organization_id=$1 and kind='break'",
    [org],
  );
});
it("refleja desactivación y desasignación sin guardar progreso ficticio", async () => {
  await db.query("update public.services set is_active=false where id=$1", [
    service,
  ]);
  expect(await read()).toMatchObject({
    service_ready: false,
    matching_hours_ready: false,
  });
  await db.query("update public.services set is_active=true where id=$1", [
    service,
  ]);
  await db.query(
    "update public.staff_profiles set is_active=false where id=$1",
    [staff],
  );
  expect(await read()).toMatchObject({
    professional_ready: false,
    service_ready: false,
    matching_hours_ready: false,
  });
  await db.query(
    "update public.staff_profiles set is_active=true where id=$1",
    [staff],
  );
  await db.query("delete from public.staff_services where organization_id=$1", [
    org,
  ]);
  expect((await read()).service_ready).toBe(false);
  await db.query(
    "insert into public.staff_services(organization_id,staff_id,service_id) values($1,$2,$3)",
    [org, staff, service],
  );
  expect((await read()).matching_hours_ready).toBe(true);
});
it("mantiene lectura histórica al vencer el plan y revoca acceso al suspender membresía", async () => {
  await db.query(
    "update public.organization_subscriptions set starts_at=now()-interval '2 days',ends_at=now()-interval '1 day' where organization_id=$1",
    [org],
  );
  expect((await read()).matching_hours_ready).toBe(true);
  expect((await read(other, accounts.other)).matching_hours_ready).toBe(false);
  await db.query(
    "update public.organization_members set is_active=false where organization_id=$1 and user_id=$2",
    [org, accounts.owner],
  );
  await expect(read()).rejects.toThrow(/Forbidden/);
});
