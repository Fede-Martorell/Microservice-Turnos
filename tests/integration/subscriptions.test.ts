import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import {
  accounts,
  createTestDatabase,
  createOrganization,
  runAs,
  saveProfessional,
  saveService,
} from "../helpers/database";
let db: PGlite, org: string;
const admin = <T>(operation: () => Promise<T>) =>
  runAs(db, accounts.stranger, operation);
async function rpc<T = unknown>(name: string, args: unknown[] = []) {
  return (
    await db.query<{ v: T }>(
      `select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) v`,
      args,
    )
  ).rows[0]!.v;
}
beforeAll(async () => {
  db = await createTestDatabase("20261022000900");
  await db.query("insert into private.platform_admins(user_id) values($1)", [
    accounts.stranger,
  ]);
  org = await createOrganization(db, accounts.owner, "planes");
});
afterAll(async () => {
  await db?.close();
});
it("provisiona una prueba finita y distingue al administrador del propietario", async () => {
  const access = await runAs(db, accounts.owner, () =>
    rpc<{
      can_write: boolean;
      modules: string[];
      subscription: { status: string };
    }>("get_organization_access", [org]),
  );
  expect(access.can_write).toBe(true);
  expect(access.subscription.status).toBe("trial");
  expect(access.modules).toContain("bookings");
  expect(
    await runAs(db, accounts.owner, () => rpc("get_platform_admin_context")),
  ).toBe(false);
  expect(await admin(() => rpc("get_platform_admin_context"))).toBe(true);
  await expect(
    runAs(db, accounts.owner, () => rpc("admin_overview")),
  ).rejects.toMatchObject({ code: "42501" });
  await expect(
    runAs(db, accounts.owner, () =>
      db.exec("update public.organization_subscriptions set status='active'"),
    ),
  ).rejects.toMatchObject({ code: "42501" });
  await expect(
    admin(() =>
      db.exec("update public.platform_audit_logs set event='plan.saved'"),
    ),
  ).rejects.toMatchObject({ code: "42501" });
});
it("el administrador no obtiene acceso a contactos ni agendas de los negocios", async () => {
  await runAs(db, accounts.owner, () => saveProfessional(db, org));
  await admin(async () => {
    expect(
      (
        await db.query(
          "select id from public.staff_profiles where organization_id=$1",
          [org],
        )
      ).rows,
    ).toEqual([]);
    expect(
      (
        await db.query(
          "select id from public.customers where organization_id=$1",
          [org],
        )
      ).rows,
    ).toEqual([]);
    expect(
      (
        await db.query(
          "select id from public.appointments where organization_id=$1",
          [org],
        )
      ).rows,
    ).toEqual([]);
    await expect(rpc("get_organization_access", [org])).rejects.toMatchObject({
      code: "42501",
    });
    const detail = await rpc<{ organization: { id: string }; notes: string }>(
      "admin_get_organization",
      [org],
    );
    expect(detail.organization.id).toBe(org);
  });
});
it("Starter aplica el cupo y los módulos desde SQL", async () => {
  await admin(() =>
    rpc("admin_save_subscription", [
      org,
      1,
      "starter",
      "pilot",
      "2026-01-01",
      "2027-01-01",
      "Prueba de capacidad",
      "Notas internas",
    ]),
  );
  await expect(
    runAs(db, accounts.owner, () => saveProfessional(db, org)),
  ).rejects.toMatchObject({ code: "P1002" });
  await expect(
    db.query(
      "insert into public.organization_members(organization_id,user_id,role) values($1,$2,'staff')",
      [org, accounts.staff],
    ),
  ).rejects.toMatchObject({ code: "P1001" });
  const access = await runAs(db, accounts.owner, () =>
    rpc<{ modules: string[] }>("get_organization_access", [org]),
  );
  expect(access.modules).not.toContain("branding");
  await expect(
    admin(() =>
      rpc("admin_save_module", [
        org,
        "payments",
        null,
        true,
        "2026-01-01",
        "2027-01-01",
        "Prueba futura",
      ]),
    ),
  ).rejects.toMatchObject({ code: "22023" });
});
it("las excepciones temporales y el vencimiento bloquean escrituras conservando lectura", async () => {
  await admin(() =>
    rpc("admin_save_module", [
      org,
      "bookings",
      null,
      false,
      "2026-01-01",
      "2027-01-01",
      "Pausa temporal",
    ]),
  );
  await expect(
    runAs(db, accounts.owner, () => saveService(db, org)),
  ).rejects.toMatchObject({ code: "P1001" });
  await admin(() =>
    rpc("admin_save_module", [
      org,
      "bookings",
      1,
      false,
      "2025-01-01",
      "2025-01-02",
      "Excepción vencida",
    ]),
  );
  await runAs(db, accounts.owner, () => saveService(db, org));
  await admin(() =>
    rpc("admin_save_subscription", [
      org,
      2,
      "starter",
      "pilot",
      "2025-01-01",
      "2025-01-02",
      "Piloto vencido",
      "Privadas",
    ]),
  );
  await runAs(db, accounts.owner, async () => {
    expect(
      (
        await db.query(
          "select id from public.services where organization_id=$1",
          [org],
        )
      ).rows,
    ).toHaveLength(1);
    expect(
      (await rpc<{ can_write: boolean }>("get_organization_access", [org]))
        .can_write,
    ).toBe(false);
    await expect(saveService(db, org)).rejects.toMatchObject({ code: "P1001" });
    await expect(
      db.exec("select * from private.pilot_notes"),
    ).rejects.toMatchObject({ code: "42501" });
  });
});
it("recibe feedback acotado incluso al vencer el piloto y audita cambios", async () => {
  const data = {
    problems: "",
    difficulty: 2,
    requests: "",
    perceived_value: 4,
    willing_to_pay: "yes",
    suggestions: "",
  };
  await runAs(db, accounts.owner, async () => {
    for (let i = 0; i < 5; i++) await rpc("save_pilot_feedback", [org, data]);
    await expect(rpc("save_pilot_feedback", [org, data])).rejects.toMatchObject(
      { code: "P1002" },
    );
  });
  await runAs(db, accounts.other, async () => {
    expect(
      (await db.query("select * from public.pilot_feedback")).rows,
    ).toEqual([]);
    await expect(rpc("save_pilot_feedback", [org, data])).rejects.toMatchObject(
      { code: "42501" },
    );
  });
  expect(
    (await admin(() => db.query("select * from public.platform_audit_logs")))
      .rows.length,
  ).toBeGreaterThan(2);
});
it("niega administración a cuentas sin confirmar y permite suspensión administrativa", async () => {
  await admin(() =>
    rpc("admin_set_organization_status", [
      org,
      "suspended",
      "Pausa del piloto",
    ]),
  );
  await admin(() =>
    rpc("admin_set_organization_status", [org, "active", "Reactivar piloto"]),
  );
  await db.query("update auth.users set email_confirmed_at=null where id=$1", [
    accounts.stranger,
  ]);
  expect(await admin(() => rpc("get_platform_admin_context"))).toBe(false);
  await expect(admin(() => rpc("admin_overview"))).rejects.toMatchObject({
    code: "42501",
  });
});
it("edita planes con versión, configura nuevas pruebas y no altera períodos existentes", async () => {
  await db.query("update auth.users set email_confirmed_at=now() where id=$1", [
    accounts.stranger,
  ]);
  const data = {
    name: "Plan piloto",
    description: "Prueba configurable",
    price_minor: 1700,
    currency: "USD",
    max_professionals: 2,
    is_active: true,
  };
  await admin(() =>
    rpc("admin_save_plan", [
      "pilot-test",
      null,
      data,
      ["bookings", "customers"],
    ]),
  );
  await admin(() =>
    rpc("admin_save_plan", [
      "pilot-test",
      1,
      { ...data, price_minor: 1900 },
      ["bookings", "customers"],
    ]),
  );
  await expect(
    admin(() => rpc("admin_save_plan", ["pilot-test", 1, data, ["bookings"]])),
  ).rejects.toMatchObject({ code: "40001" });
  await expect(
    admin(() =>
      rpc("admin_save_plan", ["future", null, data, ["bookings", "payments"]]),
    ),
  ).rejects.toMatchObject({ code: "22023" });
  await admin(() => rpc("admin_save_trial_policy", ["pilot-test", 7]));
  const newOrg = await createOrganization(db, accounts.other, "nueva-prueba");
  const s = (
    await db.query<{
      plan_code: string;
      days: number;
      quoted_price_minor: number;
    }>(
      "select plan_code,extract(epoch from ends_at-starts_at)/86400 days,quoted_price_minor from public.organization_subscriptions where organization_id=$1",
      [newOrg],
    )
  ).rows[0]!;
  expect(s.plan_code).toBe("pilot-test");
  expect(Number(s.days)).toBe(7);
  expect(s.quoted_price_minor).toBe(1900);
  expect(
    (
      await db.query<{ status: string }>(
        "select status from public.organization_subscriptions where organization_id=$1",
        [org],
      )
    ).rows[0]!.status,
  ).toBe("pilot");
});
it("migra un negocio existente sin perder catálogo y revoca equipo al vencer conservando cancelación del propietario", async () => {
  const existing = await createTestDatabase("20261021000700");
  try {
    const tenant = await createOrganization(
      existing,
      accounts.owner,
      "antes-de-planes",
    );
    await existing.query(
      "insert into public.organization_members(organization_id,user_id,role) values($1,$2,'staff')",
      [tenant, accounts.staff],
    );
    let professional = "",
      service = "";
    await runAs(existing, accounts.owner, async () => {
      professional = await saveProfessional(existing, tenant, [], {
        name: "Equipo",
        description: "",
        user_id: accounts.staff,
        photo_url: "",
        is_active: true,
      });
      service = await saveService(existing, tenant, [professional]);
    });
    const appointment = (
      await existing.query<{ id: string }>(
        `insert into public.appointments(organization_id,staff_id,service_id,customer_name,customer_email,customer_phone,service_name,staff_name,duration_minutes,preparation_minutes,price_minor,currency,timezone,starts_at,ends_at,occupied_until,status,request_key,request_hash,created_by) values($1,$2,$3,'Cliente','cliente@example.test','','Servicio','Equipo',30,0,1000,'ARS','America/Argentina/Buenos_Aires',now()+interval '7 days',now()+interval '7 days 30 minutes',now()+interval '7 days 30 minutes','confirmed',gen_random_uuid(),'fixture',$4) returning id`,
        [tenant, professional, service, accounts.owner],
      )
    ).rows[0]!.id;
    for (const file of [
      "20261022000800_plans_and_pilots.sql",
      "20261022000900_entitlement_guards.sql",
    ])
      await existing.exec(
        await readFile(
          new URL(`../../supabase/migrations/${file}`, import.meta.url),
          "utf8",
        ),
      );
    const before = (
      await existing.query<{ status: string; days: number }>(
        "select status,extract(epoch from ends_at-starts_at)/86400 days from public.organization_subscriptions where organization_id=$1",
        [tenant],
      )
    ).rows[0]!;
    expect(before.status).toBe("pilot");
    expect(Number(before.days)).toBe(30);
    expect(
      (
        await runAs(existing, accounts.staff, () =>
          existing.query(
            "select id from public.staff_profiles where organization_id=$1",
            [tenant],
          ),
        )
      ).rows,
    ).toHaveLength(1);
    await existing.query(
      "update public.organization_subscriptions set starts_at=now()-interval '2 days',ends_at=now()-interval '1 day' where organization_id=$1",
      [tenant],
    );
    expect(
      (
        await runAs(existing, accounts.staff, () =>
          existing.query("select id from public.organizations where id=$1", [
            tenant,
          ]),
        )
      ).rows,
    ).toEqual([]);
    await runAs(existing, accounts.owner, async () => {
      expect(
        (
          await existing.query(
            "select id from public.services where organization_id=$1",
            [tenant],
          )
        ).rows,
      ).toHaveLength(1);
      await expect(
        existing.query(
          "select public.change_appointment_status($1,$2,1,'completed')",
          [tenant, appointment],
        ),
      ).rejects.toMatchObject({ code: "22023" });
      await existing.query(
        "select public.change_appointment_status($1,$2,1,'canceled')",
        [tenant, appointment],
      );
      expect(
        (
          await existing.query<{ status: string }>(
            "select status from public.appointments where id=$1",
            [appointment],
          )
        ).rows[0]!.status,
      ).toBe("canceled");
    });
  } finally {
    await existing.close();
  }
});
