// Adaptador HTTP mínimo SOLO de pruebas. SQL real en PostgreSQL WASM; no simula GoTrue.
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
const db = await PGlite.create({ extensions: { btree_gist } });
const owner = "00000000-0000-4000-8000-000000000011";
await db.exec(
  `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`,
);
await db.query(
  "insert into auth.users(id,email,email_confirmed_at) values($1,'owner@example.test',now())",
  [owner],
);
const migrations = new URL("../../supabase/migrations/", import.meta.url);
for (const file of (await readdir(migrations))
  .filter((file) => file.endsWith(".sql"))
  .sort())
  await db.exec(await readFile(new URL(file, migrations), "utf8"));
await db.query(
  "insert into private.public_booking_gateway(secret_hash) values(encode(sha256(convert_to($1,'UTF8')),'hex'))",
  ["a".repeat(64)],
);
await db.exec("set role authenticated");
await db.query("select set_config('request.jwt.claim.sub',$1,false)", [owner]);
const org = (
  await db.query(
    "select public.create_organization('Estudio Horizonte','horizonte','Elegí tu próximo turno.','America/Argentina/Buenos_Aires','ARS') as id",
  )
).rows[0].id;
const profiles = [];
for (const name of ["Ana", "Bruno"])
  profiles.push(
    (
      await db.query(
        "select public.save_professional($1,null,$2::jsonb,'{}') as id",
        [
          org,
          JSON.stringify({
            name,
            description: "Atención personalizada",
            user_id: "",
            photo_url: "",
            is_active: true,
          }),
        ],
      )
    ).rows[0].id,
  );
await db.query("select public.save_service($1,null,$2::jsonb,$3::uuid[])", [
  org,
  JSON.stringify({
    name: "Consulta pública",
    description: "Una consulta para planificar tu atención.",
    category: "Consultas",
    duration_minutes: 30,
    preparation_minutes: 15,
    price_minor: 490000,
    currency: "ARS",
    image_url: "",
    is_active: true,
  }),
  profiles,
]);
for (let weekday = 0; weekday < 7; weekday++)
  for (const scope of [null, ...profiles])
    await db.query(
      "select public.save_availability_rule($1,null,$2,$3,'working',540,1080)",
      [org, scope, weekday],
    );
await db.query("select public.save_public_booking_settings($1,$2::jsonb)", [
  org,
  JSON.stringify({
    enabled: true,
    auto_confirm: true,
    contact_email: "estudio@example.test",
    contact_phone: "",
    address: "",
    cancellation_policy:
      "Podés cancelar o reprogramar hasta 24 horas antes del turno.",
    cancellation_notice_minutes: 1440,
    logo_url: "",
    cover_url: "",
    primary_color: "#355741",
    secondary_color: "#eaf0e6",
  }),
]);
await db.exec("reset role");
await db.query(
  "insert into public.organization_modules(organization_id,module_code,enabled,starts_at,ends_at,reason) values($1,'loyalty',true,now()-interval '1 day',now()+interval '30 days','Fixture aislada')",
  [org],
);
await db.exec("set role authenticated");
const service = (
  await db.query(
    "select id from public.services where organization_id=$1 limit 1",
    [org],
  )
).rows[0].id;
const date = (days) =>
  new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
await db.query(
  "select public.save_loyalty_program($1,null,$2::jsonb,$3::jsonb)",
  [
    org,
    JSON.stringify({
      name: "Club Horizonte",
      mode: "points",
      is_active: true,
      starts_on: date(-1),
      ends_on: date(30),
      conditions:
        "Completá servicios para sumar puntos. Coordiná los beneficios con el negocio.",
      expire_days: 90,
      reset_mode: "subtract",
    }),
    JSON.stringify({ [service]: 3 }),
  ],
);
const customer = (
  await db.query("select public.save_customer($1,null,null,$2::jsonb) id", [
    org,
    JSON.stringify({
      name: "Cliente tarjeta",
      email: "tarjeta@example.test",
      phone: "",
      is_active: true,
    }),
  ])
).rows[0].id;
await db.query(
  "select public.adjust_loyalty_balance($1,$2,12,'Fixture privada; no exponer este motivo',null,$3)",
  [org, customer, crypto.randomUUID()],
);
await db.query("select public.save_loyalty_reward($1,null,null,$2::jsonb)", [
  org,
  JSON.stringify({
    name: "Beneficio Horizonte",
    benefit: "Beneficio personalizado a coordinar con el negocio.",
    cost: 10,
    conditions: "Sujeto a disponibilidad del negocio.",
    starts_on: date(-1),
    ends_on: date(30),
    per_customer_limit: "",
    total_limit: "",
    is_active: true,
  }),
]);
await db.query(
  "select public.issue_loyalty_card($1,$2,encode(sha256(convert_to($3,'UTF8')),'hex'))",
  [org, customer, "b".repeat(64)],
);
await db.exec("reset role;reset request.jwt.claim.sub");
// Sesión sintética SOLO en el adaptador local: ejercita SSR sin simular GoTrue real.
const user = {
  id: owner,
  aud: "authenticated",
  role: "authenticated",
  email: "owner@example.test",
  email_confirmed_at: new Date().toISOString(),
  app_metadata: {},
  user_metadata: {},
  created_at: new Date().toISOString(),
};
const token = `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: owner, aud: "authenticated", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.fixture`;
await db.query("select set_config('request.jwt.claim.sub',$1,false)", [owner]);
const past = new Date(Date.now() - 3 * 86400000).toISOString();
await db.query(
  `insert into public.appointments(organization_id,staff_id,service_id,customer_name,customer_email,service_name,staff_name,duration_minutes,preparation_minutes,price_minor,currency,timezone,starts_at,ends_at,occupied_until,status,request_key,request_hash,created_by)
values($1,$2,$3,'Cliente resumen','resumen@example.test','Consulta pública','Ana',30,0,490000,'ARS','America/Argentina/Buenos_Aires',$4::timestamptz,$4::timestamptz+interval '30 minutes',$4::timestamptz+interval '30 minutes','completed',gen_random_uuid(),'fixture',$5)`,
  [org, profiles[0], service, past, owner],
);
await db.query(
  `insert into public.appointment_history(organization_id,appointment_id,actor_id,event,to_status,new_starts_at)
select organization_id,id,$2,'created',status,starts_at from public.appointments where organization_id=$1 and customer_email='resumen@example.test'`,
  [org, owner],
);
await db.query(
  `insert into public.appointments(organization_id,staff_id,service_id,customer_name,customer_email,service_name,staff_name,duration_minutes,preparation_minutes,price_minor,currency,timezone,starts_at,ends_at,occupied_until,status,request_key,request_hash,created_by)
values($1,$2,$3,'Cliente próximo','proximo@example.test','Consulta pública','Bruno',30,0,490000,'ARS','America/Argentina/Buenos_Aires',now()+interval '1 day',now()+interval '1 day 30 minutes',now()+interval '1 day 30 minutes','confirmed',gen_random_uuid(),'fixture',$4)`,
  [org, profiles[1], service, owner],
);
await db.exec("reset request.jwt.claim.sub");
const names = new Set([
  "get_public_booking_catalog",
  "get_public_booking_slots",
  "create_public_booking",
  "inspect_public_booking",
  "get_public_reschedule_slots",
  "manage_public_booking",
  "get_loyalty_card",
  "get_business_dashboard",
  "get_business_onboarding",
  "get_organization_access",
]);
const server = createServer(async (request, response) => {
  response.setHeader("Content-Type", "application/json");
  if (request.url === "/health") {
    response.end('{"ok":true}');
    return;
  }
  if (request.url === "/test-context") {
    response.end(JSON.stringify({ org, token, user }));
    return;
  }
  const authenticated = request.headers.authorization === `Bearer ${token}`;
  if (request.url?.startsWith("/auth/v1/user")) {
    response
      .writeHead(authenticated ? 200 : 401)
      .end(JSON.stringify(authenticated ? user : { code: "bad_jwt" }));
    return;
  }
  const url = new URL(request.url, "http://127.0.0.1");
  const table = url.pathname.replace("/rest/v1/", "");
  if (
    request.method === "GET" &&
    ["organizations", "organization_members"].includes(table)
  ) {
    if (!authenticated) {
      response.writeHead(401).end("{}");
      return;
    }
    const tenant = url.searchParams
      .get(table === "organizations" ? "id" : "organization_id")
      ?.replace(/^eq\./, "");
    if (!/^[0-9a-f-]{36}$/.test(tenant ?? "")) {
      response.writeHead(400).end("{}");
      return;
    }
    const rows = await db.transaction(async (tx) => {
      await tx.exec("set local role authenticated");
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
        owner,
      ]);
      return (
        await tx.query(
          table === "organizations"
            ? "select * from public.organizations where id=$1"
            : "select role from public.organization_members where organization_id=$1 and user_id=$2 and is_active",
          table === "organizations" ? [tenant] : [tenant, owner],
        )
      ).rows;
    });
    response.end(JSON.stringify(rows));
    return;
  }
  const name = request.url?.replace("/rest/v1/rpc/", "");
  if (request.method !== "POST" || !names.has(name)) {
    response.writeHead(404).end('{"code":"not_found"}');
    return;
  }
  try {
    let body = "";
    for await (const chunk of request) {
      body += chunk;
      if (body.length > 10000) throw new Error("body too large");
    }
    const args = JSON.parse(body);
    const ownerRpc = [
      "get_business_dashboard",
      "get_business_onboarding",
      "get_organization_access",
    ].includes(name);
    if (ownerRpc && !authenticated) {
      response.writeHead(401).end("{}");
      return;
    }
    if (Object.keys(args).some((key) => !/^p_[a-z_]+$/.test(key)))
      throw new Error("invalid parameter");
    const data = await db.transaction(async (tx) => {
      await tx.exec(
        ownerRpc ? "set local role authenticated" : "set local role anon",
      );
      if (ownerRpc)
        await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
          owner,
        ]);
      await tx.query("select set_config('request.headers',$1,true)", [
        JSON.stringify({
          "x-booking-gateway-secret":
            request.headers["x-booking-gateway-secret"] ?? "",
        }),
      ]);
      return (
        await tx.query(
          `select public.${name}(${Object.keys(args)
            .map((key, index) => `${key}=>$${index + 1}`)
            .join(",")}) as value`,
          Object.values(args),
        )
      ).rows[0].value;
    });
    response.end(JSON.stringify(data));
  } catch (error) {
    response.writeHead(error.code === "42501" ? 401 : 400).end(
      JSON.stringify({
        code: error.code ?? "test_error",
        message: "Test adapter rejected request",
      }),
    );
  }
});
server.listen(54324, "127.0.0.1", () =>
  console.log("Public booking test adapter ready on 54324"),
);
async function close() {
  server.close();
  await db.close();
  process.exit(0);
}
process.on("SIGTERM", close);
process.on("SIGINT", close);
