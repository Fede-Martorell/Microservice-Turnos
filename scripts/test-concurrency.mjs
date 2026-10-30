import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import pg from "pg";

// Solo una BD descartable en PostgreSQL local/CI. Nunca acepta Supabase ni hosts remotos.
const connection = process.env.TEST_DATABASE_URL;
if (!connection)
  throw new Error(
    "Configurá TEST_DATABASE_URL para un PostgreSQL local de pruebas. Ver docs/reservations.md.",
  );
const base = new URL(connection);
assert(
  ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname),
  "La prueba solo acepta PostgreSQL local",
);
const database = `reservas_concurrency_${randomUUID().replaceAll("-", "")}`;
const admin = new pg.Client({ connectionString: connection });
const clients = [];
let created = false;
const owner = "00000000-0000-4000-8000-000000000011";
const connect = async (url) => {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  clients.push(client);
  return client;
};
const capture = (promise) =>
  promise.then(
    (value) => ({ value }),
    (error) => ({ error }),
  );
async function observeLock(observer, target) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const { rows } = await observer.query(
      "select wait_event_type from pg_stat_activity where pid=$1",
      [target.processID],
    );
    if (rows[0]?.wait_event_type === "Lock") return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail("La segunda conexión no llegó al bloqueo esperado");
}
try {
  await admin.connect();
  await admin.query(`create database "${database}"`);
  created = true;
  const url = new URL(base);
  url.pathname = `/${database}`;
  const setup = await connect(url.toString());
  await setup.query(`do $$begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; end$$;
    create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,public to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;`);
  await setup.query(
    "insert into auth.users(id,email,email_confirmed_at) values($1,'owner@example.test',now())",
    [owner],
  );
  const directory = new URL("../supabase/migrations/", import.meta.url);
  for (const file of (await readdir(directory))
    .filter((file) => file.endsWith(".sql"))
    .sort())
    await setup.query(await readFile(new URL(file, directory), "utf8"));
  const first = await connect(url.toString());
  const second = await connect(url.toString());
  for (const client of [first, second]) {
    await client.query("set role authenticated");
    await client.query("select set_config('request.jwt.claim.sub',$1,false)", [
      owner,
    ]);
  }
  const org = (
    await first.query(
      "select public.create_organization('Prueba concurrente','concurrencia','','UTC','USD') id",
    )
  ).rows[0].id;
  const staff = (
    await first.query(
      "select public.save_professional($1,null,$2::jsonb,'{}') id",
      [
        org,
        JSON.stringify({
          name: "Profesional",
          description: "",
          user_id: "",
          photo_url: "",
          is_active: true,
        }),
      ],
    )
  ).rows[0].id;
  const service = (
    await first.query(
      "select public.save_service($1,null,$2::jsonb,$3::uuid[]) id",
      [
        org,
        JSON.stringify({
          name: "Servicio",
          description: "",
          category: "",
          duration_minutes: 30,
          preparation_minutes: 15,
          price_minor: 1000,
          currency: "USD",
          image_url: "",
          is_active: true,
        }),
        [staff],
      ],
    )
  ).rows[0].id;
  const instant = (
    await first.query(
      "select date_trunc('day',now()+interval '7 days')+interval '9 hours' instant",
    )
  ).rows[0].instant;
  const weekday = instant.getUTCDay();
  for (const scope of [null, staff])
    await first.query(
      "select public.save_availability_rule($1,null,$2,$3,'working',0,1440)",
      [org, scope, weekday],
    );
  const create = (client, key, when = instant) =>
    client.query(
      "select public.create_appointment($1,$2,$3,$4,'Cliente','cliente@example.test','','confirmed',$5) id",
      [org, service, staff, when, key],
    );

  // RPC: primera escritura sin confirmar, segunda petición ya esperando el lock del negocio.
  await first.query("begin");
  const key = randomUUID();
  const id = (await create(first, key)).rows[0].id;
  const competing = capture(create(second, randomUUID()));
  await observeLock(setup, second);
  await first.query("commit");
  assert.equal((await competing).error?.code, "23P01");
  assert.equal(
    (await setup.query("select count(*)::int n from public.appointments"))
      .rows[0].n,
    1,
  );
  assert.equal(
    (
      await setup.query(
        "select count(*)::int n from public.appointment_history",
      )
    ).rows[0].n,
    1,
  );
  assert.equal((await create(second, key)).rows[0].id, id);
  console.log(
    "PASS: dos reservas simultáneas → una reserva, un historial y conflicto controlado",
  );

  // Restricción GiST aislada: dos INSERT privilegiados omiten deliberadamente la RPC y su lock.
  const writerA = await connect(url.toString());
  const writerB = await connect(url.toString());
  const clone = (client) =>
    client.query(
      `insert into public.appointments(organization_id,staff_id,service_id,customer_name,customer_email,customer_phone,service_name,staff_name,duration_minutes,preparation_minutes,price_minor,currency,timezone,starts_at,ends_at,occupied_until,status,request_key,request_hash,created_by)
   select organization_id,staff_id,service_id,customer_name,customer_email,customer_phone,service_name,staff_name,duration_minutes,preparation_minutes,price_minor,currency,timezone,starts_at+interval '3 hours',ends_at+interval '3 hours',occupied_until+interval '3 hours',status,gen_random_uuid(),request_hash,created_by from public.appointments where id=$1`,
      [id],
    );
  await writerA.query("begin");
  await clone(writerA);
  const bypassing = capture(clone(writerB));
  await observeLock(setup, writerB);
  await writerA.query("commit");
  assert.equal((await bypassing).error?.code, "23P01");
  console.log(
    "PASS: dos INSERT simultáneos sin RPC → la restricción GiST impide la superposición",
  );

  // La misma clave enviada simultáneamente produce la misma reserva una sola vez.
  const later = new Date(instant.getTime() + 6 * 3600000);
  const replayKey = randomUUID();
  await first.query("begin");
  const original = (await create(first, replayKey, later)).rows[0].id;
  const replaying = capture(create(second, replayKey, later));
  await observeLock(setup, second);
  await first.query("commit");
  assert.equal((await replaying).value?.rows[0].id, original);
  assert.equal(
    (
      await setup.query(
        "select count(*)::int n from public.appointments where request_key=$1",
        [replayKey],
      )
    ).rows[0].n,
    1,
  );
  console.log(
    "PASS: reintento simultáneo → mismo ID y sin duplicar la reserva",
  );
  // Misma frontera que usa la página pública, con rol anon y clave dedicada.
  const gatewaySecret = "a".repeat(64);
  await setup.query(
    "insert into private.public_booking_gateway(secret_hash) values(encode(sha256(convert_to($1,'UTF8')),'hex'))",
    [gatewaySecret],
  );
  await first.query(
    "select public.save_public_booking_settings($1,$2::jsonb)",
    [
      org,
      JSON.stringify({
        enabled: true,
        auto_confirm: true,
        contact_email: "",
        contact_phone: "",
        address: "",
        cancellation_policy: "Cambios con al menos un día de anticipación.",
        cancellation_notice_minutes: 1440,
        logo_url: "",
        cover_url: "",
        primary_color: "#355741",
        secondary_color: "#eaf0e6",
      }),
    ],
  );
  const versions = (
    await setup.query(
      "select s.updated_at::text as service_version,p.updated_at::text as settings_version from public.services s join public.public_booking_settings p on p.organization_id=s.organization_id where s.id=$1",
      [service],
    )
  ).rows[0];
  for (const client of [first, second]) {
    await client.query("reset role;set role anon");
    await client.query("select set_config('request.headers',$1,false)", [
      JSON.stringify({ "x-booking-gateway-secret": gatewaySecret }),
    ]);
  }
  const guestKey = randomUUID(),
    guestInstant = new Date(instant.getTime() + 9 * 3600000);
  const guestCreate = (client, key = guestKey) =>
    client.query(
      "select public.create_public_booking('concurrencia',$1,$2,$3,'Invitado','invitado@example.test','',$4,$5,$6,$7,$8) as result",
      [
        service,
        staff,
        guestInstant,
        key,
        "b".repeat(64),
        "c".repeat(64),
        versions.service_version,
        versions.settings_version,
      ],
    );
  await first.query("begin");
  assert.equal((await guestCreate(first)).rows[0].result.ok, true);
  const guestConflict = capture(guestCreate(second, randomUUID()));
  await observeLock(setup, second);
  await first.query("commit");
  assert.equal((await guestConflict).value?.rows[0].result.code, "unavailable");
  assert.equal(
    (
      await setup.query(
        "select count(*)::int n from public.appointments where source='public'",
      )
    ).rows[0].n,
    1,
  );
  console.log(
    "PASS: dos reservas públicas simultáneas → un turno y conflicto, sin cuenta de usuario",
  );
  assert.equal((await guestCreate(second)).rows[0].result.ok, true);
  assert.equal(
    (
      await setup.query(
        "select count(*)::int n from public.appointment_history where actor_kind='guest'",
      )
    ).rows[0].n,
    1,
  );
  console.log(
    "PASS: reintento público → conserva un solo turno y un solo historial",
  );
  // Dos workers no reclaman la misma entrega; SKIP LOCKED no espera el lease ajeno.
  await setup.query(
    "insert into private.notification_worker(secret_hash) values(encode(sha256(convert_to($1,'UTF8')),'hex'))",
    [gatewaySecret],
  );
  await setup.query(
    "insert into public.notification_settings(organization_id,enabled) values($1,true)",
    [org],
  );
  await setup.query(
    "select private.enqueue_notification(a,'created',now()) from public.appointments a where a.id=$1",
    [id],
  );
  for (const client of [first, second])
    await client.query("select set_config('request.headers',$1,false)", [
      JSON.stringify({ "x-notification-worker-secret": gatewaySecret }),
    ]);
  await first.query("begin");
  const claimA = (
    await first.query("select public.claim_notification_jobs(1,null) result")
  ).rows[0].result;
  assert.equal(claimA.length, 1);
  const claimB = (
    await second.query("select public.claim_notification_jobs(1,null) result")
  ).rows[0].result;
  assert.equal(claimB.length, 0);
  await first.query("commit");
  assert.equal(
    (await second.query("select public.claim_notification_jobs(1,null) result"))
      .rows[0].result.length,
    0,
  );
  console.log(
    "PASS: dos workers simultáneos → un único lease, sin duplicar la entrega",
  );
  // El cupo se verifica bajo el mismo bloqueo de organización en ambas conexiones.
  for (const client of [first, second]) {
    await client.query("reset role;set role authenticated");
    await client.query("select set_config('request.jwt.claim.sub',$1,false)", [
      owner,
    ]);
  }
  const capOrg = (
    await first.query(
      "select public.create_organization('Cupo','cupo','','America/Argentina/Buenos_Aires','ARS') id",
    )
  ).rows[0].id;
  await setup.query(
    "update public.organization_subscriptions set plan_code='starter' where organization_id=$1",
    [capOrg],
  );
  const professional = (client, name) =>
    client.query(
      "select public.save_professional($1,null,$2::jsonb,'{}'::uuid[])",
      [
        capOrg,
        JSON.stringify({
          name,
          description: "",
          user_id: "",
          photo_url: "",
          is_active: true,
        }),
      ],
    );
  await first.query("begin");
  await professional(first, "Primero");
  const overCapacity = capture(professional(second, "Segundo"));
  await observeLock(setup, second);
  await first.query("commit");
  assert.equal((await overCapacity).error?.code, "P1002");
  assert.equal(
    (
      await setup.query(
        "select count(*)::int n from public.staff_profiles where organization_id=$1 and is_active",
        [capOrg],
      )
    ).rows[0].n,
    1,
  );
  console.log(
    "PASS: dos altas de profesionales simultáneas → se respeta el cupo del plan",
  );
  await setup.query(
    "insert into public.organization_modules(organization_id,module_code,enabled,starts_at,ends_at,reason) values($1,'loyalty',true,now()-interval '1 day',now()+interval '30 days','Pruebas de concurrencia')",
    [org],
  );
  const day = (offset) =>
    new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
  await first.query(
    "select public.save_loyalty_program($1,null,$2::jsonb,$3::jsonb)",
    [
      org,
      JSON.stringify({
        name: "Programa",
        mode: "points",
        is_active: true,
        starts_on: day(-30),
        ends_on: day(30),
        conditions: "Pruebas de concurrencia",
        expire_days: "",
        reset_mode: "subtract",
      }),
      JSON.stringify({ [service]: 1 }),
    ],
  );
  const customer = (
    await setup.query(
      "select customer_id from public.appointments where id=$1",
      [id],
    )
  ).rows[0].customer_id;
  const credit = (client, target, amount) =>
    client.query(
      "select public.adjust_loyalty_balance($1,$2,$3,'Crédito de prueba',null,$4)",
      [org, target, amount, randomUUID()],
    );
  const rewardData = {
    name: "Recompensa",
    benefit: "Beneficio de prueba",
    cost: 10,
    conditions: "Condiciones de prueba",
    starts_on: day(-1),
    ends_on: day(30),
    per_customer_limit: "",
    total_limit: "",
    is_active: true,
  };
  const reward = (
    await first.query(
      "select public.save_loyalty_reward($1,null,null,$2::jsonb) id",
      [org, JSON.stringify(rewardData)],
    )
  ).rows[0].id;
  const redeem = (
    client,
    target = customer,
    benefit = reward,
    key = randomUUID(),
  ) =>
    client.query("select public.redeem_loyalty_reward($1,$2,$3,1,$4) id", [
      org,
      target,
      benefit,
      key,
    ]);
  await credit(first, customer, 10);
  await first.query("begin");
  await redeem(first);
  const doubleSpend = capture(redeem(second));
  await observeLock(setup, second);
  await first.query("commit");
  assert.equal((await doubleSpend).error?.code, "P2001");
  console.log(
    "PASS: dos canjes simultáneos del último saldo → un canje, sin saldo negativo",
  );
  await credit(first, customer, 10);
  const retryKey = randomUUID();
  await first.query("begin");
  const redemption = (await redeem(first, customer, reward, retryKey)).rows[0]
    .id;
  const duplicate = capture(redeem(second, customer, reward, retryKey));
  await observeLock(setup, second);
  await first.query("commit");
  assert.equal((await duplicate).value?.rows[0].id, redemption);
  console.log(
    "PASS: reintento concurrente del canje → mismo registro y un único consumo",
  );
  const otherCustomer = (
    await first.query(
      "select public.save_customer($1,null,null,$2::jsonb) id",
      [
        org,
        JSON.stringify({
          name: "Otro cliente",
          email: "otro-loyalty@example.test",
          phone: "",
          is_active: true,
        }),
      ],
    )
  ).rows[0].id;
  await credit(first, customer, 1);
  await credit(first, otherCustomer, 1);
  const limited = (
    await first.query(
      "select public.save_loyalty_reward($1,null,null,$2::jsonb) id",
      [
        org,
        JSON.stringify({
          ...rewardData,
          name: "Último cupo",
          cost: 1,
          total_limit: 1,
        }),
      ],
    )
  ).rows[0].id;
  await first.query("begin");
  await redeem(first, customer, limited);
  const stock = capture(redeem(second, otherCustomer, limited));
  await observeLock(setup, second);
  await first.query("commit");
  assert.equal((await stock).error?.code, "P2002");
  console.log(
    "PASS: dos clientes compiten por el último cupo → se respeta el límite global",
  );
  await setup.query(
    "update public.appointments set starts_at=now()-interval '2 hours',ends_at=now()-interval '90 minutes',occupied_until=now()-interval '75 minutes' where id=$1",
    [id],
  );
  const appointmentVersion = (
    await setup.query("select version from public.appointments where id=$1", [
      id,
    ])
  ).rows[0].version;
  await first.query("begin");
  await first.query(
    "select public.change_appointment_status($1,$2,$3,'completed')",
    [org, id, appointmentVersion],
  );
  const completion = capture(
    second.query(
      "select public.change_appointment_status($1,$2,$3,'completed')",
      [org, id, appointmentVersion],
    ),
  );
  await observeLock(setup, second);
  await first.query("commit");
  assert.equal((await completion).error?.code, "40001");
  assert.equal(
    (
      await setup.query(
        "select count(*)::int n from public.loyalty_transactions where appointment_id=$1 and kind='earned'",
        [id],
      )
    ).rows[0].n,
    1,
  );
  console.log(
    "PASS: completar dos veces en paralelo → una sola acreditación de fidelización",
  );
} finally {
  await Promise.allSettled(clients.map((client) => client.end()));
  if (created) await admin.query(`drop database "${database}" with (force)`);
  await admin.end();
}
