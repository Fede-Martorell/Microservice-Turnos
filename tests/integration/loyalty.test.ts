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
import {
  cardSchema,
  configSchema,
  customerLoyaltySchema,
} from "@/features/loyalty/schema";
let db: PGlite,
  org: string,
  other: string,
  staff: string,
  service: string,
  customer: string,
  program: string,
  reward: string;
let sequence = 0;
const owner = <T>(operation: () => Promise<T>) =>
  runAs(db, accounts.owner, operation);
async function rpc<T = unknown>(name: string, args: unknown[]) {
  return (
    await db.query<{ v: T }>(
      `select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) v`,
      args,
    )
  ).rows[0]!.v;
}
const data = {
  name: "Mi programa",
  mode: "points",
  is_active: true,
  starts_on: "2026-01-01",
  ends_on: "2027-01-01",
  conditions: "Condiciones del programa",
  expire_days: "30",
  reset_mode: "subtract",
};
const rewardData = {
  name: "Beneficio",
  benefit: "Un beneficio definido por el negocio",
  cost: 5,
  conditions: "Coordinar con el negocio",
  starts_on: "2026-01-01",
  ends_on: "2027-01-01",
  per_customer_limit: "2",
  total_limit: "3",
  is_active: true,
};
async function appointment(
  status = "confirmed",
  email = "loyalty@example.test",
  tenant = org,
  profile = staff,
  svc = service,
) {
  const starts = new Date(
    Date.now() - 7 * 86400000 + sequence++ * 3600000,
  ).toISOString();
  return (
    await db.query<{ id: string }>(
      `insert into public.appointments(organization_id,staff_id,service_id,customer_name,customer_email,customer_phone,service_name,staff_name,duration_minutes,preparation_minutes,price_minor,currency,timezone,starts_at,ends_at,occupied_until,status,request_key,request_hash,created_by) values($1,$2,$3,'Cliente',$4,'','Servicio','Profesional',30,0,1000,'ARS','America/Argentina/Buenos_Aires',$5::timestamptz,$5::timestamptz+interval '30 minutes',$5::timestamptz+interval '30 minutes',$6,gen_random_uuid(),'fixture',$7) returning id`,
      [tenant, profile, svc, email, starts, status, accounts.owner],
    )
  ).rows[0]!.id;
}
async function complete() {
  const id = await appointment();
  await owner(() =>
    rpc("change_appointment_status", [org, id, 1, "completed"]),
  );
  return id;
}
async function details() {
  return owner(() =>
    rpc<{
      account_id: string;
      balance: number;
      transactions: {
        id: string;
        amount: number;
        kind: string;
        rule_id: string;
      }[];
      redemptions: { id: string; voided: boolean }[];
    }>("get_loyalty_customer", [org, customer, 0]),
  );
}
beforeAll(async () => {
  db = await createTestDatabase("20261022001000");
  org = await createOrganization(db, accounts.owner, "fidelizacion");
  other = await createOrganization(db, accounts.other, "otro-fiel");
  await owner(async () => {
    staff = await saveProfessional(db, org);
    service = await saveService(db, org, [staff]);
    customer = await rpc<string>("save_customer", [
      org,
      null,
      null,
      {
        name: "Cliente",
        email: "loyalty@example.test",
        phone: "",
        is_active: true,
      },
    ]);
  });
});
afterAll(async () => {
  await db?.close();
});
it("exige propietario y complemento; no se autoactiva por el plan", async () => {
  await expect(
    owner(() =>
      rpc("save_loyalty_program", [org, null, data, { [service]: 3 }]),
    ),
  ).rejects.toMatchObject({ code: "P1001" });
  await db.query(
    "insert into public.organization_modules(organization_id,module_code,enabled,starts_at,ends_at,reason) values($1,'loyalty',true,now()-interval '1 day',now()+interval '90 days','Prueba del complemento')",
    [org],
  );
  await expect(
    runAs(db, accounts.staff, () =>
      rpc("save_loyalty_program", [org, null, data, { [service]: 3 }]),
    ),
  ).rejects.toMatchObject({ code: "42501" });
  program = await owner(() =>
    rpc<string>("save_loyalty_program", [org, null, data, { [service]: 3 }]),
  );
  expect(program).toBeTruthy();
  await expect(
    owner(() => rpc("save_loyalty_program", [org, 9, data, { [service]: 3 }])),
  ).rejects.toMatchObject({ code: "40001" });
});
it("solo acredita al completar y conserva la regla histórica ante cambios", async () => {
  await appointment("completed");
  expect((await details()).balance).toBe(0);
  const id = await complete();
  let d = await details();
  expect(d.balance).toBe(3);
  const originalRule = d.transactions[0]!.rule_id;
  await db.query(
    "update public.appointments set version=version+1 where id=$1",
    [id],
  );
  expect((await details()).balance).toBe(3);
  await owner(() =>
    rpc("save_loyalty_program", [
      org,
      1,
      { ...data, conditions: "Nuevas condiciones" },
      { [service]: 7 },
    ]),
  );
  await complete();
  d = await details();
  expect(d.balance).toBe(10);
  expect(
    d.transactions.some((t) => t.rule_id === originalRule && t.amount === 3),
  ).toBe(true);
  await expect(
    owner(() =>
      rpc("save_loyalty_program", [
        org,
        2,
        { ...data, mode: "visits" },
        { [service]: 1 },
      ]),
    ),
  ).rejects.toMatchObject({ code: "P2003" });
  await appointment("canceled");
  await appointment("no_show");
  expect((await details()).balance).toBe(10);
});
it("canjea sin saldo negativo, deduplica y guarda condiciones históricas", async () => {
  reward = await owner(() =>
    rpc<string>("save_loyalty_reward", [org, null, null, rewardData]),
  );
  const key = crypto.randomUUID();
  const id = await owner(() =>
    rpc<string>("redeem_loyalty_reward", [org, customer, reward, 1, key]),
  );
  expect(
    await owner(() =>
      rpc("redeem_loyalty_reward", [org, customer, reward, 1, key]),
    ),
  ).toBe(id);
  expect((await details()).balance).toBe(5);
  await expect(
    owner(() => rpc("redeem_loyalty_reward", [org, customer, reward, 2, key])),
  ).rejects.toMatchObject({ code: "22023" });
  await owner(() =>
    rpc("save_loyalty_reward", [
      org,
      reward,
      1,
      { ...rewardData, cost: 20, benefit: "Otra recompensa" },
    ]),
  );
  const snapshot = (
    await db.query<{ reward_snapshot: { cost: number; benefit: string } }>(
      "select reward_snapshot from public.loyalty_redemptions where id=$1",
      [id],
    )
  ).rows[0]!.reward_snapshot;
  expect(snapshot.cost).toBe(5);
  expect(snapshot.benefit).toBe(rewardData.benefit);
  await expect(
    owner(() =>
      rpc("redeem_loyalty_reward", [
        org,
        customer,
        reward,
        1,
        crypto.randomUUID(),
      ]),
    ),
  ).rejects.toMatchObject({ code: "40001" });
  await expect(
    owner(() =>
      rpc("redeem_loyalty_reward", [
        org,
        customer,
        reward,
        2,
        crypto.randomUUID(),
      ]),
    ),
  ).rejects.toMatchObject({ code: "P2001" });
  expect((await details()).balance).toBe(5);
});
it("anula mediante créditos nuevos con la vigencia original, una sola vez", async () => {
  const id = (await details()).redemptions[0]!.id;
  const key = crypto.randomUUID();
  const result = await owner(() =>
    rpc("void_loyalty_redemption", [org, id, "Prueba de anulación", key]),
  );
  expect(
    await owner(() =>
      rpc("void_loyalty_redemption", [org, id, "Prueba de anulación", key]),
    ),
  ).toBe(result);
  expect((await details()).balance).toBe(10);
  await expect(
    owner(() =>
      rpc("void_loyalty_redemption", [
        org,
        id,
        "Otro intento de anulación",
        crypto.randomUUID(),
      ]),
    ),
  ).rejects.toMatchObject({ code: "22023" });
  const count = (
    await db.query<{ n: number }>(
      "select count(distinct expires_at)::int n from public.loyalty_transactions where kind='refund'",
      [],
    )
  ).rows[0]!.n;
  expect(count).toBeGreaterThan(0);
});
it("ajusta con motivo, idempotencia y referencias del mismo cliente; ledger inmutable", async () => {
  const before = await details();
  const key = crypto.randomUUID();
  const tx = await owner(() =>
    rpc("adjust_loyalty_balance", [
      org,
      customer,
      -2,
      "Corregir acreditación",
      before.transactions[0]!.id,
      key,
    ]),
  );
  expect(
    await owner(() =>
      rpc("adjust_loyalty_balance", [
        org,
        customer,
        -2,
        "Corregir acreditación",
        before.transactions[0]!.id,
        key,
      ]),
    ),
  ).toBe(tx);
  expect((await details()).balance).toBe(8);
  await expect(
    owner(() =>
      rpc("adjust_loyalty_balance", [
        org,
        customer,
        -9,
        "Saldo insuficiente",
        null,
        crypto.randomUUID(),
      ]),
    ),
  ).rejects.toMatchObject({ code: "P2001" });
  await expect(
    owner(() => db.exec("update public.loyalty_transactions set amount=100")),
  ).rejects.toMatchObject({ code: "42501" });
  await expect(
    db.exec("delete from public.loyalty_transactions"),
  ).rejects.toMatchObject({ code: "55000" });
  await runAs(db, accounts.other, async () => {
    expect(
      (await db.query("select id from public.loyalty_accounts")).rows,
    ).toEqual([]);
    await expect(
      rpc("get_loyalty_customer", [org, customer, 0]),
    ).rejects.toMatchObject({ code: "42501" });
  });
  await runAs(db, accounts.staff, async () => {
    expect(
      (await db.query("select id from public.loyalty_transactions")).rows,
    ).toEqual([]);
  });
});
it("excluye lotes vencidos y la baja del módulo detiene acreditaciones y canjes", async () => {
  const d = await details();
  await db.query(
    "insert into public.loyalty_transactions(organization_id,account_id,kind,amount,expires_at,reason,created_by) values($1,$2,'adjustment',99,now()-interval '1 day','Lote vencido de prueba',$3)",
    [org, d.account_id, accounts.owner],
  );
  expect((await details()).balance).toBe(8);
  await db.query(
    "update public.organization_modules set enabled=false where organization_id=$1 and module_code='loyalty'",
    [org],
  );
  await complete();
  expect((await details()).balance).toBe(8);
  await expect(
    owner(() =>
      rpc("adjust_loyalty_balance", [
        org,
        customer,
        1,
        "Sin módulo activo",
        null,
        crypto.randomUUID(),
      ]),
    ),
  ).rejects.toMatchObject({ code: "P1001" });
  await db.query(
    "update public.organization_modules set enabled=true where organization_id=$1 and module_code='loyalty'",
    [org],
  );
  expect(other).toBeTruthy();
});
it("la tarjeta exige gateway y token, devuelve contrato acotado y admite rotación/revocación", async () => {
  const secret = "6".repeat(64),
    token = "7".repeat(64);
  const hash = (value: string) =>
    db
      .query<{ hash: string }>(
        "select encode(sha256(convert_to($1,'UTF8')),'hex') hash",
        [value],
      )
      .then((r) => r.rows[0]!.hash);
  await db.query(
    "insert into private.public_booking_gateway(secret_hash) values($1)",
    [await hash(secret)],
  );
  const firstHash = await hash(token);
  await owner(() => rpc("issue_loyalty_card", [org, customer, firstHash]));
  async function guest(key = secret, raw = token) {
    return runAs(
      db,
      null,
      async () => {
        await db.query("select set_config('request.headers',$1,false)", [
          JSON.stringify({ "x-booking-gateway-secret": key }),
        ]);
        try {
          return await rpc<{ ok: boolean; code?: string; card: unknown }>(
            "get_loyalty_card",
            [raw, "9".repeat(64)],
          );
        } finally {
          await db.exec("reset request.headers");
        }
      },
      "anon",
    );
  }
  await expect(guest("")).rejects.toMatchObject({ code: "42501" });
  const card = cardSchema.parse((await guest()).card);
  expect(card.balance).toBe(8);
  expect(card.expiry.expired_balance).toBe(99);
  for (const forbidden of [
    "loyalty@example.test",
    "account_id",
    "customer_id",
    "created_by",
    "Corregir acreditación",
  ])
    expect(JSON.stringify(card)).not.toContain(forbidden);
  await db.query(
    "update public.organization_modules set enabled=false where organization_id=$1 and module_code='loyalty'",
    [org],
  );
  expect(cardSchema.parse((await guest()).card).operational).toBe(false);
  await db.query(
    "update public.organization_modules set enabled=true where organization_id=$1 and module_code='loyalty'",
    [org],
  );
  const newHash = await hash("a".repeat(64));
  await owner(() => rpc("issue_loyalty_card", [org, customer, newHash]));
  expect((await guest()).code).toBe("not_found");
  await owner(() => rpc("revoke_loyalty_card", [org, customer]));
  expect((await guest(secret, "a".repeat(64))).code).toBe("not_found");
  const cfg = configSchema.parse(
    await owner(() => rpc("get_loyalty_config", [org])),
  );
  expect(cfg.program?.version).toBe(2);
  expect(cfg.mode_locked).toBe(true);
  customerLoyaltySchema.parse(
    await owner(() => rpc("get_loyalty_customer", [org, customer, 0])),
  );
});
it("pausa sin perder reglas, permite correcciones y no acredita completadas durante la pausa", async () => {
  await owner(() => rpc("set_loyalty_program_active", [org, 2, false]));
  await complete();
  expect((await details()).balance).toBe(8);
  await owner(() => rpc("set_loyalty_program_active", [org, 3, true]));
  await complete();
  expect((await details()).balance).toBe(15);
  await expect(
    owner(() => rpc("get_loyalty_accounts", [other, "", 0])),
  ).rejects.toMatchObject({ code: "42501" });
  expect(
    await owner(() =>
      rpc<unknown[]>("get_loyalty_accounts", [org, "Cliente", 0]),
    ),
  ).toHaveLength(1);
});
it("admite visitas, reinicio a cero y límites por cliente; anular libera el cupo", async () => {
  await db.query(
    "insert into public.organization_modules(organization_id,module_code,enabled,starts_at,ends_at,reason) values($1,'loyalty',true,now()-interval '1 day',now()+interval '90 days','Prueba de visitas')",
    [other],
  );
  const otherOwner = <T>(call: () => Promise<T>) =>
    runAs(db, accounts.other, call);
  let professional = "",
    svc = "",
    client = "",
    benefit = "";
  await otherOwner(async () => {
    professional = await saveProfessional(db, other);
    svc = await saveService(db, other, [professional]);
    await expect(
      rpc("save_loyalty_program", [
        other,
        null,
        { ...data, mode: "visits", reset_mode: "reset" },
        { [svc]: 2 },
      ]),
    ).rejects.toMatchObject({ code: "22023" });
    await rpc("save_loyalty_program", [
      other,
      null,
      { ...data, mode: "visits", reset_mode: "reset" },
      { [svc]: 1 },
    ]);
    client = await rpc<string>("save_customer", [
      other,
      null,
      null,
      {
        name: "Otro cliente",
        email: "visits@example.test",
        phone: "",
        is_active: true,
      },
    ]);
    benefit = await rpc<string>("save_loyalty_reward", [
      other,
      null,
      null,
      { ...rewardData, cost: 2, per_customer_limit: 1, total_limit: 1 },
    ]);
  });
  for (let i = 0; i < 3; i++) {
    const appt = await appointment(
      "confirmed",
      "visits@example.test",
      other,
      professional,
      svc,
    );
    await otherOwner(() =>
      rpc("change_appointment_status", [other, appt, 1, "completed"]),
    );
  }
  const before = customerLoyaltySchema.parse(
    await otherOwner(() => rpc("get_loyalty_customer", [other, client, 0])),
  );
  expect(before.balance).toBe(3);
  const id = await otherOwner(() =>
    rpc<string>("redeem_loyalty_reward", [
      other,
      client,
      benefit,
      1,
      crypto.randomUUID(),
    ]),
  );
  expect(
    customerLoyaltySchema.parse(
      await otherOwner(() => rpc("get_loyalty_customer", [other, client, 0])),
    ).balance,
  ).toBe(0);
  await otherOwner(() =>
    rpc("adjust_loyalty_balance", [
      other,
      client,
      5,
      "Crédito de prueba",
      null,
      crypto.randomUUID(),
    ]),
  );
  await expect(
    otherOwner(() =>
      rpc("redeem_loyalty_reward", [
        other,
        client,
        benefit,
        1,
        crypto.randomUUID(),
      ]),
    ),
  ).rejects.toMatchObject({ code: "P2002" });
  await otherOwner(() =>
    rpc("void_loyalty_redemption", [
      other,
      id,
      "Canje de prueba anulado",
      crypto.randomUUID(),
    ]),
  );
  expect(
    customerLoyaltySchema.parse(
      await otherOwner(() => rpc("get_loyalty_customer", [other, client, 0])),
    ).balance,
  ).toBe(8);
  await expect(
    owner(() =>
      rpc("adjust_loyalty_balance", [
        org,
        client,
        1,
        "Cliente de otro negocio",
        null,
        crypto.randomUUID(),
      ]),
    ),
  ).rejects.toMatchObject({ code: "22023" });
});
it("anular un canje no revive los créditos cuyo vencimiento ya pasó", async () => {
  const initial = await details();
  await db.query(
    "insert into public.loyalty_transactions(organization_id,account_id,kind,amount,expires_at,reason,created_by) values($1,$2,'adjustment',2,now()+interval '1 second','Lote de vencimiento cercano',$3)",
    [org, initial.account_id, accounts.owner],
  );
  const small = await owner(() =>
    rpc<string>("save_loyalty_reward", [
      org,
      null,
      null,
      { ...rewardData, name: "Beneficio breve", cost: 2 },
    ]),
  );
  const redemption = await owner(() =>
    rpc<string>("redeem_loyalty_reward", [
      org,
      customer,
      small,
      1,
      crypto.randomUUID(),
    ]),
  );
  await new Promise((resolve) => setTimeout(resolve, 1200));
  await owner(() =>
    rpc("void_loyalty_redemption", [
      org,
      redemption,
      "Anulación con lote ya vencido",
      crypto.randomUUID(),
    ]),
  );
  expect((await details()).balance).toBe(initial.balance);
});
it("el precio del complemento requiere administración sin conceder lectura de saldos", async () => {
  await expect(
    owner(() => rpc("admin_save_module_price", ["loyalty", 1100, "USD"])),
  ).rejects.toMatchObject({ code: "42501" });
  await db.query("insert into private.platform_admins(user_id) values($1)", [
    accounts.stranger,
  ]);
  await runAs(db, accounts.stranger, async () => {
    await rpc("admin_save_module_price", ["loyalty", 1100, "USD"]);
    expect(
      (await db.query("select * from public.loyalty_accounts")).rows,
    ).toEqual([]);
    await expect(rpc("get_loyalty_config", [org])).rejects.toMatchObject({
      code: "42501",
    });
  });
  expect(
    (
      await db.query<{ reference_price_minor: number }>(
        "select reference_price_minor from public.module_catalog where code='loyalty'",
      )
    ).rows[0]!.reference_price_minor,
  ).toBe(1100);
});
