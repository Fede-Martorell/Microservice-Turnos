import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { readFile, readdir } from "node:fs/promises";

export const accounts = {
  owner: "00000000-0000-4000-8000-000000000011",
  other: "00000000-0000-4000-8000-000000000012",
  staff: "00000000-0000-4000-8000-000000000013",
  stranger: "00000000-0000-4000-8000-000000000014",
};

export async function createTestDatabase(through = "20261021000200") {
  const db = await PGlite.create({ extensions: { btree_gist } });
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,public to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;
  `);
  for (const [name, id] of Object.entries(accounts))
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",
      [id, `${name}@example.test`],
    );
  const directory = new URL("../../supabase/migrations/", import.meta.url);
  for (const file of (await readdir(directory))
    .filter((file) => file.endsWith(".sql") && file.slice(0, 14) <= through)
    .sort())
    await db.exec(await readFile(new URL(file, directory), "utf8"));
  return db;
}

export async function runAs<T>(
  db: PGlite,
  account: string | null,
  operation: () => Promise<T>,
  role: "authenticated" | "anon" = "authenticated",
) {
  await db.exec(`set role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    account ?? "",
  ]);
  try {
    return await operation();
  } finally {
    await db.exec("reset role; reset request.jwt.claim.sub");
  }
}

export async function createOrganization(
  db: PGlite,
  account: string,
  slug: string,
) {
  return runAs(
    db,
    account,
    async () =>
      (
        await db.query<{ id: string }>(
          "select public.create_organization('Estudio',$1,'','America/Argentina/Buenos_Aires','ARS') id",
          [slug],
        )
      ).rows[0]!.id,
  );
}

export const serviceData = {
  name: "Consulta",
  description: "",
  category: "",
  duration_minutes: 30,
  preparation_minutes: 10,
  price_minor: 250050,
  currency: "ARS",
  image_url: "",
  is_active: true,
};
export const professionalData = {
  name: "Profesional",
  description: "",
  user_id: "",
  photo_url: "",
  is_active: true,
};

export async function saveService(
  db: PGlite,
  org: string,
  staffIds: string[] = [],
  data = serviceData,
  id: string | null = null,
) {
  return (
    await db.query<{ id: string }>(
      "select public.save_service($1,$2,$3::jsonb,$4::uuid[]) id",
      [org, id, JSON.stringify(data), staffIds],
    )
  ).rows[0]!.id;
}
export async function saveProfessional(
  db: PGlite,
  org: string,
  serviceIds: string[] = [],
  data = professionalData,
  id: string | null = null,
) {
  return (
    await db.query<{ id: string }>(
      "select public.save_professional($1,$2,$3::jsonb,$4::uuid[]) id",
      [org, id, JSON.stringify(data), serviceIds],
    )
  ).rows[0]!.id;
}
