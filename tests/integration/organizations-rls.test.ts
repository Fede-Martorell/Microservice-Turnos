import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

// PostgreSQL real compilado a WASM. El harness instala únicamente la interfaz
// mínima de Auth (auth.users / auth.uid); no reemplaza probar GoTrue/PostgREST.
const users = {
  ownerA: "00000000-0000-4000-8000-000000000001",
  ownerB: "00000000-0000-4000-8000-000000000002",
  staffA: "00000000-0000-4000-8000-000000000003",
  outsider: "00000000-0000-4000-8000-000000000004",
  unconfirmed: "00000000-0000-4000-8000-000000000005",
  anonymousAuth: "00000000-0000-4000-8000-000000000006",
};
let db: PGlite;
let organizationA: string;
let organizationB: string;

async function asUser<T>(
  userId: string | null,
  work: () => Promise<T>,
  role: "authenticated" | "anon" = "authenticated",
) {
  await db.exec(`set role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
    userId ?? "",
  ]);
  try {
    return await work();
  } finally {
    await db.exec("reset role");
    await db.exec("reset request.jwt.claim.sub");
  }
}

async function createOrganization(user: string, slug: string) {
  return asUser(user, async () => {
    const result = await db.query<{ id: string }>(
      "select public.create_organization($1,$2,$3,$4,$5) as id",
      ["Estudio de pruebas", slug, "", "America/Argentina/Buenos_Aires", "ARS"],
    );
    return result.rows[0]!.id;
  });
}

beforeAll(async () => {
  db = await PGlite.create();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users(id uuid primary key, email_confirmed_at timestamptz, is_anonymous boolean default false);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  for (const [name, id] of Object.entries(users))
    await db.query(
      "insert into auth.users(id, email_confirmed_at, is_anonymous) values($1,$2,$3)",
      [
        id,
        name === "unconfirmed" ? null : new Date().toISOString(),
        name === "anonymousAuth",
      ],
    );
  const migration = await readFile(
    new URL(
      "../../supabase/migrations/20261021000100_organizations_and_access.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await db.exec(migration);
  organizationA = await createOrganization(users.ownerA, "negocio-a");
  organizationB = await createOrganization(users.ownerB, "negocio-b");
  await db.query(
    "insert into public.organization_members(organization_id,user_id,role) values($1,$2,'staff')",
    [organizationA, users.staffA],
  );
});
afterAll(async () => {
  await db?.close();
});

describe("aislamiento e integridad de organizaciones en PostgreSQL", () => {
  it("crea propietario, configuración y auditoría atómicamente", async () => {
    await asUser(users.ownerA, async () => {
      expect(
        (
          await db.query(
            "select * from public.organization_members where organization_id=$1 and user_id=$2 and role='owner'",
            [organizationA, users.ownerA],
          )
        ).rows,
      ).toHaveLength(1);
      expect(
        (
          await db.query(
            "select * from public.organization_settings where organization_id=$1",
            [organizationA],
          )
        ).rows,
      ).toHaveLength(1);
      expect(
        (
          await db.query(
            "select * from public.audit_logs where organization_id=$1 and event='organization.created'",
            [organizationA],
          )
        ).rows,
      ).toHaveLength(1);
    });
  });
  it("owner solo ve su organización, miembros, settings y auditoría", async () => {
    await asUser(users.ownerA, async () => {
      for (const table of [
        "organizations",
        "organization_settings",
        "audit_logs",
      ])
        expect(
          (await db.query(`select * from public.${table}`)).rows,
        ).toHaveLength(1);
      expect(
        (await db.query("select * from public.organization_members")).rows,
      ).toHaveLength(2);
      expect(
        (
          await db.query("select * from public.organizations where id=$1", [
            organizationB,
          ])
        ).rows,
      ).toHaveLength(0);
    });
  });
  it("staff accede a su negocio y membresía, pero no al equipo ni auditoría", async () => {
    await asUser(users.staffA, async () => {
      expect(
        (await db.query("select * from public.organizations")).rows,
      ).toHaveLength(1);
      expect(
        (await db.query("select * from public.organization_members")).rows,
      ).toHaveLength(1);
      expect(
        (await db.query("select * from public.audit_logs")).rows,
      ).toHaveLength(0);
      expect(
        (
          await db.query(
            "update public.organizations set name='Cambio staff' where id=$1 returning id",
            [organizationA],
          )
        ).rows,
      ).toHaveLength(0);
      expect(
        (
          await db.query(
            "update public.organization_settings set locale='en' where organization_id=$1 returning organization_id",
            [organizationA],
          )
        ).rows,
      ).toHaveLength(0);
    });
  });
  it("un usuario sin membresía no ve ningún tenant", async () => {
    await asUser(users.outsider, async () => {
      for (const table of [
        "organizations",
        "organization_members",
        "organization_settings",
        "audit_logs",
      ])
        expect(
          (await db.query(`select * from public.${table}`)).rows,
        ).toHaveLength(0);
    });
  });
  it("owner no puede actualizar otra organización ni referenciar sus settings", async () => {
    await asUser(users.ownerA, async () => {
      expect(
        (
          await db.query(
            "update public.organizations set name='Ataque' where id=$1 returning id",
            [organizationB],
          )
        ).rows,
      ).toHaveLength(0);
      expect(
        (
          await db.query(
            "update public.organization_settings set locale='en' where organization_id=$1 returning organization_id",
            [organizationB],
          )
        ).rows,
      ).toHaveLength(0);
      await expect(
        db.query(
          "insert into public.organization_settings(organization_id) values($1)",
          [organizationB],
        ),
      ).rejects.toMatchObject({ code: "42501" });
    });
  });
  it("ni owner ni staff pueden promoverse, agregar miembros o cambiar el tenant", async () => {
    for (const actor of [users.ownerA, users.staffA])
      await asUser(actor, async () => {
        await expect(
          db.query(
            "update public.organization_members set role='owner' where user_id=$1",
            [users.staffA],
          ),
        ).rejects.toMatchObject({ code: "42501" });
        await expect(
          db.query(
            "update public.organization_members set organization_id=$1 where user_id=$2",
            [organizationB, users.staffA],
          ),
        ).rejects.toMatchObject({ code: "42501" });
        await expect(
          db.query(
            "insert into public.organization_members(organization_id,user_id,role) values($1,$2,'owner')",
            [organizationB, users.outsider],
          ),
        ).rejects.toMatchObject({ code: "42501" });
      });
  });
  it("owner edita campos permitidos con auditoría y no altera estado, slug ni creador", async () => {
    await asUser(users.ownerA, async () => {
      expect(
        (
          await db.query(
            "update public.organizations set name='Nuevo nombre' where id=$1 returning name",
            [organizationA],
          )
        ).rows,
      ).toEqual([{ name: "Nuevo nombre" }]);
      expect(
        (
          await db.query(
            "select * from public.audit_logs where event='organization.updated'",
          )
        ).rows,
      ).toHaveLength(1);
      expect(
        (
          await db.query(
            "update public.organization_settings set locale='es' where organization_id=$1 returning locale",
            [organizationA],
          )
        ).rows,
      ).toEqual([{ locale: "es" }]);
      for (const [column, value] of [
        ["status", "suspended"],
        ["slug", "nuevo-slug"],
        ["created_by", users.ownerB],
      ])
        await expect(
          db.query(`update public.organizations set ${column}=$1 where id=$2`, [
            value,
            organizationA,
          ]),
        ).rejects.toMatchObject({ code: "42501" });
    });
  });
  it("rechaza borrados, inserciones directas y modificaciones de auditoría", async () => {
    await asUser(users.ownerA, async () => {
      await expect(
        db.query("delete from public.organizations where id=$1", [
          organizationA,
        ]),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        db.query(
          "insert into public.organizations(name,slug,created_by) values('Ataque','insercion-directa',$1)",
          [users.ownerA],
        ),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        db.query("update public.audit_logs set event='organization.created'"),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        db.query("delete from public.audit_logs"),
      ).rejects.toMatchObject({ code: "42501" });
    });
  });
  it("protege slugs únicos, zona horaria y rollback de creaciones inválidas", async () => {
    await expect(
      createOrganization(users.ownerA, "negocio-b"),
    ).rejects.toMatchObject({ code: "23505" });
    await expect(
      createOrganization(users.ownerA, "panel"),
    ).rejects.toMatchObject({ code: "23514" });
    await asUser(users.ownerA, async () => {
      await expect(
        db.query(
          "select public.create_organization('Zona inválida','zona-invalida','','Mars/Base','ARS')",
        ),
      ).rejects.toMatchObject({ code: "23514" });
      expect(
        (await db.query("select * from public.organizations")).rows,
      ).toHaveLength(1);
    });
  });
  it("impide acceso y creación anónima o sin confirmación", async () => {
    await asUser(
      null,
      async () => {
        await expect(
          db.query("select * from public.organizations"),
        ).rejects.toMatchObject({ code: "42501" });
        await expect(
          db.query(
            "select public.create_organization('Anon','anon-test','','UTC','USD')",
          ),
        ).rejects.toMatchObject({ code: "42501" });
      },
      "anon",
    );
    for (const actor of [users.unconfirmed, users.anonymousAuth])
      await expect(
        createOrganization(actor, "no-confirmada"),
      ).rejects.toMatchObject({ code: "42501" });
    await asUser(null, async () => {
      await expect(
        db.query(
          "select public.create_organization('Anon','sin-identidad','','UTC','USD')",
        ),
      ).rejects.toMatchObject({ code: "42501" });
    });
  });
  it("revoca acceso inmediatamente al desactivar membresía o suspender tenant", async () => {
    await db.query(
      "update public.organization_members set is_active=false where user_id=$1",
      [users.staffA],
    );
    await asUser(users.staffA, async () => {
      expect(
        (await db.query("select * from public.organizations")).rows,
      ).toHaveLength(0);
    });
    await db.query(
      "update public.organizations set status='suspended' where id=$1",
      [organizationB],
    );
    await asUser(users.ownerB, async () => {
      expect(
        (await db.query("select * from public.organizations")).rows,
      ).toHaveLength(0);
      expect(
        (
          await db.query(
            "update public.organizations set name='No permitido' where id=$1 returning id",
            [organizationB],
          )
        ).rows,
      ).toHaveLength(0);
    });
  });
  it("limita creaciones por usuario usando el estado transaccional de BD", async () => {
    await createOrganization(users.outsider, "limite-uno");
    await createOrganization(users.outsider, "limite-dos");
    await createOrganization(users.outsider, "limite-tres");
    await expect(
      createOrganization(users.outsider, "limite-cuatro"),
    ).rejects.toMatchObject({ code: "P0001" });
    await asUser(users.outsider, async () => {
      expect(
        (await db.query("select * from public.organizations")).rows,
      ).toHaveLength(3);
    });
  });
});
