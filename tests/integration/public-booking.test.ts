import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  accounts,
  createTestDatabase,
  createOrganization,
  runAs,
  saveService,
  saveProfessional,
  professionalData,
} from "../helpers/database";
let db: PGlite;
let org: string;
let service: string;
let staff: string;
let otherStaff: string;
let day: string;
let serviceVersion: string;
let settingsVersion: string;
const secret = "a".repeat(64),
  visitor = "b".repeat(64),
  token = "c".repeat(64),
  secondToken = "d".repeat(64);
type Result = {
  ok: boolean;
  code?: string;
  receipt?: {
    status: string;
    version: number;
    price_minor: number;
    can_manage: boolean;
    starts_at: string;
  };
  catalog?: { services: { id: string }[]; professionals: unknown[] };
  slots?: { starts_at: string }[];
};
async function rpc(name: string, args: unknown[]) {
  return (
    await db.query<{ value: Result }>(
      `select public.${name}(${args.map((_, index) => `$${index + 1}`).join(",")}) as value`,
      args,
    )
  ).rows[0]!.value;
}
async function guest<T>(operation: () => Promise<T>, key = secret) {
  return runAs(
    db,
    null,
    async () => {
      await db.query("select set_config('request.headers',$1,false)", [
        JSON.stringify({ "x-booking-gateway-secret": key }),
      ]);
      try {
        return await operation();
      } finally {
        await db.exec("reset request.headers");
      }
    },
    "anon",
  );
}
const tokenHash = (value: string) =>
  db
    .query<{ value: string }>(
      "select encode(sha256(convert_to($1,'UTF8')),'hex') as value",
      [value],
    )
    .then((result) => result.rows[0]!.value);
const at = (hour: string) => `${day}T${hour}:00-03:00`;
async function book(
  hour: string,
  rawToken = token,
  key = crypto.randomUUID(),
  profile: string | null = staff,
  email = "guest@example.test",
  who = visitor,
) {
  return rpc("create_public_booking", [
    "publico",
    service,
    profile,
    at(hour),
    "Cliente público",
    email,
    "",
    key,
    await tokenHash(rawToken),
    who,
    serviceVersion,
    settingsVersion,
  ]);
}
beforeAll(async () => {
  db = await createTestDatabase("20261022000900");
  org = await createOrganization(db, accounts.owner, "publico");
  await db.query("insert into private.platform_admins(user_id) values($1)", [
    accounts.stranger,
  ]);
  await db.query(
    "insert into public.notification_settings(organization_id,enabled,reminders_enabled) values($1,true,true)",
    [org],
  );
  await db.query(
    "insert into private.public_booking_gateway(secret_hash) values($1)",
    [await tokenHash(secret)],
  );
  day = (
    await db.query<{ value: string }>(
      "select to_char(current_date+7,'YYYY-MM-DD') as value",
    )
  ).rows[0]!.value;
  await runAs(db, accounts.owner, async () => {
    staff = await saveProfessional(db, org);
    otherStaff = await saveProfessional(db, org, [], {
      ...professionalData,
      name: "Segundo profesional",
    });
    service = await saveService(db, org, [staff, otherStaff]);
    for (let weekday = 0; weekday < 7; weekday++)
      for (const scope of [null, staff, otherStaff])
        await db.query(
          "select public.save_availability_rule($1,null,$2,$3,'working',480,1200)",
          [org, scope, weekday],
        );
  });
});
afterAll(async () => {
  await db?.close();
});
describe("frontera pública, reservas sin cuenta y gestión por token", () => {
  it("mantiene todas las tablas privadas cerradas y exige credencial del intermediario", async () => {
    await guest(async () => {
      await expect(
        db.query("select * from public.appointments"),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        db.query("select * from private.public_booking_access"),
      ).rejects.toMatchObject({ code: "42501" });
    });
    await expect(
      guest(() => rpc("get_public_booking_catalog", ["publico", visitor]), ""),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      guest(
        () => rpc("get_public_booking_catalog", ["publico", visitor]),
        "f".repeat(64),
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("no publica hasta que owner lo habilita y devuelve solo campos públicos activos", async () => {
    expect(
      await guest(() =>
        rpc("get_public_booking_catalog", ["publico", visitor]),
      ),
    ).toEqual({ ok: false, code: "not_found" });
    const data = {
      enabled: true,
      auto_confirm: false,
      contact_email: "negocio@example.test",
      contact_phone: "",
      address: "",
      cancellation_policy:
        "Podés cancelar o reprogramar con 24 horas de anticipación.",
      cancellation_notice_minutes: 1440,
      logo_url: "",
      cover_url: "",
      primary_color: "#355741",
      secondary_color: "#eaf0e6",
    };
    await runAs(db, accounts.other, async () => {
      await expect(
        db.query("select public.save_public_booking_settings($1,$2::jsonb)", [
          org,
          JSON.stringify(data),
        ]),
      ).rejects.toMatchObject({ code: "42501" });
    });
    await runAs(db, accounts.owner, () =>
      db.query("select public.save_public_booking_settings($1,$2::jsonb)", [
        org,
        JSON.stringify(data),
      ]),
    );
    const result = await guest(() =>
      rpc("get_public_booking_catalog", ["publico", visitor]),
    );
    expect(result.ok).toBe(true);
    expect(result.catalog?.services).toHaveLength(1);
    expect(result.catalog?.professionals).toHaveLength(2);
    const serialized = JSON.stringify(result);
    for (const key of [
      "user_id",
      "organization_id",
      "customer_email",
      "token_hash",
      "reason",
      "created_by",
    ])
      expect(serialized).not.toContain(key);
    const versions = (
      await db.query<{ service_version: string; settings_version: string }>(
        "select s.updated_at::text as service_version,p.updated_at::text as settings_version from public.services s join public.public_booking_settings p on p.organization_id=s.organization_id where s.id=$1",
        [service],
      )
    ).rows[0]!;
    serviceVersion = versions.service_version;
    settingsVersion = versions.settings_version;
  });
  it("lista disponibilidad individual o cualquiera sin exponer reservas ni motivos privados", async () =>
    guest(async () => {
      const result = await rpc("get_public_booking_slots", [
        "publico",
        service,
        null,
        day,
        visitor,
      ]);
      expect(result.ok).toBe(true);
      expect(result.slots?.length).toBeGreaterThan(0);
      expect(JSON.stringify(result)).not.toContain("customer");
      expect(
        (
          await rpc("get_public_booking_slots", [
            "publico",
            accounts.other,
            staff,
            day,
            visitor,
          ])
        ).slots,
      ).toEqual([]);
    }));
  it("reserva sin auth, guarda condiciones y deduplica la misma solicitud sin duplicar historial", async () =>
    guest(async () => {
      const key = crypto.randomUUID();
      const result = await book("09:00", token, key);
      expect(result.ok).toBe(true);
      expect(result.receipt?.status).toBe("pending");
      expect(result.receipt?.price_minor).toBe(250050);
      expect((await book("09:00", token, key)).ok).toBe(true);
      expect(
        (
          await book(
            "09:00",
            secondToken,
            key,
            staff,
            "guest@example.test",
            "e".repeat(64),
          )
        ).code,
      ).toBe("invalid");
      expect((await rpc("inspect_public_booking", [token, visitor])).ok).toBe(
        true,
      );
    }));
  it("la reserva pública vincula cliente y outbox una sola vez y conserva acceso por hash", async () => {
    const row = (
      await db.query<{
        appointment_id: string;
        customer_id: string;
        visitor_hash: string;
        token_hash: string;
      }>(
        `select a.id appointment_id,a.customer_id,t.visitor_hash,t.token_hash from public.appointments a join private.public_booking_access t on t.appointment_id=a.id where a.source='public' order by a.created_at limit 1`,
      )
    ).rows[0]!;
    expect(row.customer_id).toBeTruthy();
    expect(row.token_hash).toBe(await tokenHash(token));
    expect(row.visitor_hash).toBe(visitor);
    expect(
      (
        await db.query(
          "select * from public.notification_jobs where appointment_id=$1 and kind='created'",
          [row.appointment_id],
        )
      ).rows,
    ).toHaveLength(1);
    expect(
      (
        await db.query("select * from public.customers where id=$1", [
          row.customer_id,
        ])
      ).rows,
    ).toHaveLength(1);
  });
  it("rechaza token ajeno/inválido/vencido y no permite controlar una reserva por UUID", async () => {
    expect(
      await guest(() =>
        rpc("inspect_public_booking", ["e".repeat(64), visitor]),
      ),
    ).toEqual({ ok: false, code: "not_found" });
    expect(
      await guest(() => rpc("inspect_public_booking", [org, visitor])),
    ).toEqual({ ok: false, code: "not_found" });
    const row = (
      await db.query<{ appointment_id: string }>(
        "select appointment_id from private.public_booking_access where token_hash=$1",
        [await tokenHash(token)],
      )
    ).rows[0]!;
    expect(
      (
        await db.query(
          "select source,created_by from public.appointments where id=$1",
          [row.appointment_id],
        )
      ).rows[0],
    ).toEqual({ source: "public", created_by: null });
    expect(
      (
        await db.query(
          "select count(*)::int as n from public.appointment_history where appointment_id=$1",
          [row.appointment_id],
        )
      ).rows[0],
    ).toEqual({ n: 1 });
    await db.query(
      "update private.public_booking_access set expires_at=now()-interval '1 minute' where appointment_id=$1",
      [row.appointment_id],
    );
    expect(
      (await guest(() => rpc("inspect_public_booking", [token, visitor]))).code,
    ).toBe("not_found");
    await db.query(
      "update private.public_booking_access set expires_at=now()+interval '20 days' where appointment_id=$1",
      [row.appointment_id],
    );
  });
  it("reprograma con duración histórica, detecta versiones viejas y cancela sin borrar", async () => {
    await guest(async () => {
      expect(
        (
          await rpc("manage_public_booking", [
            token,
            visitor,
            1,
            "reschedule",
            at("10:00"),
          ])
        ).ok,
      ).toBe(true);
      expect(
        (
          await rpc("manage_public_booking", [
            token,
            visitor,
            1,
            "cancel",
            null,
          ])
        ).code,
      ).toBe("stale");
      expect(
        (
          await rpc("manage_public_booking", [
            token,
            visitor,
            2,
            "cancel",
            null,
          ])
        ).receipt?.status,
      ).toBe("canceled");
      expect(
        (
          await rpc("manage_public_booking", [
            token,
            visitor,
            3,
            "reschedule",
            at("11:00"),
          ])
        ).code,
      ).toBe("policy");
    });
    expect(
      (
        await db.query(
          "select count(*)::int as n from public.appointments where source='public'",
        )
      ).rows[0],
    ).toEqual({ n: 1 });
  });
  it("cualquiera disponible asigna otro profesional si el primero está ocupado", async () => {
    await db.exec("truncate private.public_booking_limits");
    const one = await guest(() =>
      book(
        "12:00",
        secondToken,
        crypto.randomUUID(),
        staff,
        "one@example.test",
      ),
    );
    expect(one.ok).toBe(true);
    const two = await guest(() =>
      book(
        "12:00",
        "e".repeat(64),
        crypto.randomUUID(),
        null,
        "two@example.test",
      ),
    );
    expect(two.ok).toBe(true);
    expect(
      (
        await db.query(
          "select count(distinct staff_id)::int as n from public.appointments where starts_at=$1",
          [at("12:00")],
        )
      ).rows[0],
    ).toEqual({ n: 2 });
    expect(
      (
        await guest(() =>
          book(
            "12:00",
            "f".repeat(64),
            crypto.randomUUID(),
            null,
            "three@example.test",
          ),
        )
      ).code,
    ).toBe("unavailable");
  });
  it("los conflictos consumen cuota persistente y no se revierten con el fallo de reserva", async () => {
    await db.exec("truncate private.public_booking_limits");
    for (let index = 0; index < 3; index++)
      expect(
        (
          await guest(() =>
            book(
              "12:00",
              "f".repeat(64),
              crypto.randomUUID(),
              null,
              "abuse@example.test",
            ),
          )
        ).code,
      ).toBe("unavailable");
    expect(
      (
        await guest(() =>
          book(
            "12:00",
            "f".repeat(64),
            crypto.randomUUID(),
            null,
            "abuse@example.test",
          ),
        )
      ).code,
    ).toBe("rate_limited");
    expect(
      (
        await db.query<{ attempts: number }>(
          "select attempts from private.public_booking_limits where bucket='booking_email'",
        )
      ).rows[0]?.attempts,
    ).toBe(4);
  });
  it("el enlace acompaña una reprogramación del equipo sin cambiar el token", async () => {
    const row = (
      await db.query<{ id: string; expires_at: string }>(
        "select appointment_id as id,expires_at::text from private.public_booking_access where token_hash=$1",
        [await tokenHash("e".repeat(64))],
      )
    ).rows[0]!;
    const later = (
      await db.query<{ value: string }>(
        "select to_char(current_date+20,'YYYY-MM-DD')||'T15:00:00-03:00' as value",
      )
    ).rows[0]!.value;
    await runAs(db, accounts.owner, () =>
      db.query("select public.reschedule_appointment($1,$2,1,$3)", [
        org,
        row.id,
        later,
      ]),
    );
    const expiry = (
      await db.query<{ matches: boolean }>(
        "select t.expires_at=a.occupied_until+interval '7 days' as matches from private.public_booking_access t join public.appointments a on a.id=t.appointment_id where a.id=$1",
        [row.id],
      )
    ).rows[0]!;
    expect(expiry.matches).toBe(true);
    expect(
      (
        await guest(() =>
          rpc("inspect_public_booking", ["e".repeat(64), visitor]),
        )
      ).receipt?.version,
    ).toBe(2);
  });
  it("rechaza presupuestos viejos y revierte una escritura parcial si colisiona el token", async () => {
    await db.exec("truncate private.public_booking_limits");
    const stale = await guest(() =>
      rpc("create_public_booking", [
        "publico",
        service,
        staff,
        at("15:00"),
        "Cliente",
        "stale@example.test",
        "",
        crypto.randomUUID(),
        "f".repeat(64),
        visitor,
        "2000-01-01T00:00:00Z",
        settingsVersion,
      ]),
    );
    expect(stale.code).toBe("stale");
    const before = (
      await db.query<{ n: number }>(
        "select count(*)::int as n from public.appointments",
      )
    ).rows[0]!.n;
    expect(
      (
        await guest(() =>
          book(
            "15:00",
            token,
            crypto.randomUUID(),
            staff,
            "collision@example.test",
          ),
        )
      ).code,
    ).toBe("unavailable");
    expect(
      (
        await db.query<{ n: number }>(
          "select count(*)::int as n from public.appointments",
        )
      ).rows[0]!.n,
    ).toBe(before);
  });
  it("oculta un negocio suspendido y protege también sus enlaces existentes", async () => {
    await runAs(db, accounts.stranger, () =>
      db.query(
        "select public.admin_set_organization_status($1,'suspended','Suspensión de prueba')",
        [org],
      ),
    );
    expect(
      (
        await guest(() =>
          rpc("get_public_booking_catalog", ["publico", visitor]),
        )
      ).code,
    ).toBe("not_found");
    expect(
      (
        await guest(() =>
          rpc("inspect_public_booking", ["e".repeat(64), visitor]),
        )
      ).code,
    ).toBe("not_found");
    await runAs(db, accounts.stranger, () =>
      db.query(
        "select public.admin_set_organization_status($1,'active','Reactivación de prueba')",
        [org],
      ),
    );
  });
  it("respeta política histórica, estados finales y revocación por owner", async () => {
    await db.exec("truncate private.public_booking_limits");
    const id = (
      await db.query<{ id: string }>(
        "select appointment_id as id from private.public_booking_access where token_hash=$1",
        [await tokenHash(secondToken)],
      )
    ).rows[0]!.id;
    await db.query(
      "update public.appointments set starts_at=now()+interval '2 hours',ends_at=now()+interval '150 minutes',occupied_until=now()+interval '160 minutes' where id=$1",
      [id],
    );
    expect(
      (
        await guest(() =>
          rpc("manage_public_booking", [
            secondToken,
            visitor,
            1,
            "cancel",
            null,
          ]),
        )
      ).code,
    ).toBe("policy");
    await runAs(db, accounts.owner, () =>
      db.query("select public.revoke_public_booking_link($1,$2)", [org, id]),
    );
    expect(
      (await guest(() => rpc("inspect_public_booking", [secondToken, visitor])))
        .code,
    ).toBe("not_found");
  });
  it("oculta personalización al retirar branding sin borrar los ajustes", async () => {
    await db.exec("truncate private.public_booking_limits");
    await db.query(
      "update public.public_booking_settings set logo_url='https://example.test/logo.png',primary_color='#112233' where organization_id=$1",
      [org],
    );
    await db.query(
      "insert into public.organization_modules(organization_id,module_code,enabled,starts_at,ends_at,reason) values($1,'branding',false,now()-interval '1 day',now()+interval '1 day','Prueba sin marca')",
      [org],
    );
    const result = await guest(() =>
      rpc("get_public_booking_catalog", ["publico", visitor]),
    );
    expect(JSON.stringify(result)).not.toContain(
      "https://example.test/logo.png",
    );
    expect(JSON.stringify(result)).not.toContain("#112233");
    expect(
      (
        await db.query<{ logo_url: string }>(
          "select logo_url from public.public_booking_settings where organization_id=$1",
          [org],
        )
      ).rows[0]!.logo_url,
    ).toBe("https://example.test/logo.png");
    await db.query(
      "delete from public.organization_modules where organization_id=$1 and module_code='branding'",
      [org],
    );
    settingsVersion = (
      await db.query<{ v: string }>(
        "select updated_at::text v from public.public_booking_settings where organization_id=$1",
        [org],
      )
    ).rows[0]!.v;
  });
  it("al vencer oculta la página, vacía horarios y bloquea avisos pero conserva la cancelación pública", async () => {
    await db.exec("truncate private.public_booking_limits");
    const fresh = "9".repeat(64);
    const created = await guest(() =>
      book("18:00", fresh, crypto.randomUUID(), staff, "expiry@example.test"),
    );
    expect(created.ok).toBe(true);
    const id = (
      await db.query<{ id: string }>(
        "select appointment_id id from private.public_booking_access where token_hash=$1",
        [await tokenHash(fresh)],
      )
    ).rows[0]!.id;
    await db.query(
      "update public.organization_subscriptions set ends_at=now()-interval '1 second',starts_at=now()-interval '2 days' where organization_id=$1",
      [org],
    );
    expect(
      (
        await guest(() =>
          rpc("get_public_booking_catalog", ["publico", visitor]),
        )
      ).code,
    ).toBe("not_found");
    expect(
      (
        await guest(() =>
          rpc("get_public_booking_slots", [
            "publico",
            service,
            staff,
            day,
            visitor,
          ]),
        )
      ).slots,
    ).toEqual([]);
    expect(
      (
        await runAs(db, accounts.owner, () =>
          db.query("select * from public.get_available_slots($1,$2,$3,$4)", [
            org,
            service,
            staff,
            day,
          ]),
        )
      ).rows,
    ).toEqual([]);
    expect(
      (
        await db.query<{ eligible: boolean }>(
          "select private.notification_eligible(j) eligible from public.notification_jobs j where appointment_id=$1",
          [id],
        )
      ).rows.every((j) => !j.eligible),
    ).toBe(true);
    expect((await guest(() => book("19:00", "8".repeat(64)))).code).toBe(
      "not_found",
    );
    expect(
      (
        await guest(() =>
          rpc("get_public_reschedule_slots", [fresh, day, visitor]),
        )
      ).slots,
    ).toEqual([]);
    expect(
      (
        await guest(() =>
          rpc("manage_public_booking", [fresh, visitor, 1, "cancel", null]),
        )
      ).receipt?.status,
    ).toBe("canceled");
    const jobs = (
      await db.query<{ n: number }>(
        "select count(*)::int n from public.notification_jobs where appointment_id=$1 and kind='canceled'",
        [id],
      )
    ).rows[0]!.n;
    expect(jobs).toBe(0);
  });
});
