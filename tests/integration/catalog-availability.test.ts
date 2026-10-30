import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import {
  accounts,
  createTestDatabase,
  createOrganization,
  runAs,
  saveService,
  saveProfessional,
  serviceData,
  professionalData,
} from "../helpers/database";

let db: PGlite,
  org: string,
  otherOrg: string,
  staff: string,
  otherStaff: string,
  service: string,
  otherService: string;
beforeAll(async () => {
  db = await createTestDatabase();
  org = await createOrganization(db, accounts.owner, "catalogo-a");
  otherOrg = await createOrganization(db, accounts.other, "catalogo-b");
  await runAs(db, accounts.owner, async () => {
    staff = await saveProfessional(db, org);
    service = await saveService(db, org, [staff]);
  });
  await runAs(db, accounts.other, async () => {
    otherStaff = await saveProfessional(db, otherOrg);
    otherService = await saveService(db, otherOrg, [otherStaff]);
  });
});
afterAll(async () => {
  await db?.close();
});

describe("catálogo, horarios y aislamiento SQL", () => {
  it("permite profesionales sin cuenta y relaciones del mismo negocio", async () => {
    await runAs(db, accounts.owner, async () => {
      expect(
        (await db.query("select user_id from public.staff_profiles")).rows,
      ).toEqual([{ user_id: null }]);
      expect(
        (await db.query("select * from public.staff_services")).rows,
      ).toHaveLength(1);
      expect(
        (await db.query("select * from public.services")).rows,
      ).toHaveLength(1);
    });
  });
  it("no admite asignaciones ni cambios de registros entre tenants", async () => {
    await runAs(db, accounts.owner, async () => {
      await expect(saveService(db, org, [otherStaff])).rejects.toMatchObject({
        code: "23503",
      });
      await expect(
        saveProfessional(db, org, [otherService]),
      ).rejects.toMatchObject({ code: "23503" });
      await expect(saveService(db, otherOrg)).rejects.toMatchObject({
        code: "42501",
      });
      await expect(
        saveService(db, org, [], serviceData, otherService),
      ).rejects.toMatchObject({ code: "P0002" });
      expect(
        (await db.query("select * from public.services")).rows,
      ).toHaveLength(1);
    });
  });
  it("actualiza y desactiva sin borrar el recurso ni perder ID", async () => {
    await runAs(db, accounts.owner, async () => {
      expect(
        await saveService(
          db,
          org,
          [staff],
          { ...serviceData, price_minor: 350000, is_active: false },
          service,
        ),
      ).toBe(service);
      expect(
        (
          await db.query(
            "select is_active,price_minor from public.services where id=$1",
            [service],
          )
        ).rows,
      ).toEqual([{ is_active: false, price_minor: 350000 }]);
      await saveService(db, org, [staff], serviceData, service);
      await saveProfessional(
        db,
        org,
        [service],
        { ...professionalData, is_active: false },
        staff,
      );
      expect(
        (
          await db.query(
            "select is_active from public.staff_profiles where id=$1",
            [staff],
          )
        ).rows,
      ).toEqual([{ is_active: false }]);
      await saveProfessional(db, org, [service], professionalData, staff);
      await expect(
        db.query("delete from public.services"),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        db.query("update public.staff_profiles set name='Sin RPC'"),
      ).rejects.toMatchObject({ code: "42501" });
    });
  });
  it("rechaza duraciones, importes fraccionarios y monedas inválidas en SQL", async () => {
    await runAs(db, accounts.owner, async () => {
      for (const data of [
        { ...serviceData, duration_minutes: 0 },
        { ...serviceData, price_minor: -1 },
        { ...serviceData, preparation_minutes: 121 },
        { ...serviceData, currency: "$" },
      ])
        await expect(saveService(db, org, [], data)).rejects.toMatchObject({
          code: "23514",
        });
      await expect(
        saveService(db, org, [], { ...serviceData, price_minor: 1.5 }),
      ).rejects.toMatchObject({ code: "22P02" });
    });
  });
  it("guarda jornada dividida, descanso y rechaza superposición del mismo tipo", async () => {
    await runAs(db, accounts.owner, async () => {
      await db.query(
        "select public.save_availability_rule($1,null,null,1,'working',540,1080)",
        [org],
      );
      await db.query(
        "select public.save_availability_rule($1,null,$2,1,'working',540,1080)",
        [org, staff],
      );
      await db.query(
        "select public.save_availability_rule($1,null,$2,1,'break',720,780)",
        [org, staff],
      );
      await expect(
        db.query(
          "select public.save_availability_rule($1,null,$2,1,'working',600,660)",
          [org, staff],
        ),
      ).rejects.toMatchObject({ code: "23P01" });
      await expect(
        db.query(
          "select public.save_availability_rule($1,null,$2,7,'working',540,600)",
          [org, staff],
        ),
      ).rejects.toMatchObject({ code: "23514" });
      await expect(
        db.query(
          "select public.save_availability_rule($1,null,$2,1,'working',1200,100)",
          [org, staff],
        ),
      ).rejects.toMatchObject({ code: "23514" });
    });
  });
  it("guarda vacaciones globales y bloqueos parciales, sin rangos inconsistentes", async () => {
    await runAs(db, accounts.owner, async () => {
      await db.query(
        "select public.save_availability_exception($1,null,$2,'2027-01-01','2027-01-10',null,null,'vacation','Vacaciones')",
        [org, staff],
      );
      await db.query(
        "select public.save_availability_exception($1,null,null,'2027-02-01','2027-02-01',600,720,'blocked','Bloqueo')",
        [org],
      );
      await expect(
        db.query(
          "select public.save_availability_exception($1,null,$2,'2027-01-10','2027-01-01',null,null,'blocked','')",
          [org, staff],
        ),
      ).rejects.toMatchObject({ code: "23514" });
      await expect(
        db.query(
          "select public.save_availability_exception($1,null,$2,'2027-01-01','2027-01-01',600,null,'blocked','')",
          [org, staff],
        ),
      ).rejects.toMatchObject({ code: "23514" });
      await expect(
        db.query(
          "select public.save_availability_exception($1,null,$2,'2027-01-01','2027-01-01',null,null,'blocked','')",
          [org, otherStaff],
        ),
      ).rejects.toMatchObject({ code: "23503" });
    });
  });
  it("owner puede corregir y retirar reglas, siempre con auditoría", async () => {
    await runAs(db, accounts.owner, async () => {
      const id = (
        await db.query<{ id: string }>(
          "select public.save_availability_rule($1,null,null,2,'working',540,600) id",
          [org],
        )
      ).rows[0]!.id;
      await db.query(
        "select public.save_availability_rule($1,$2,null,2,'working',540,660)",
        [org, id],
      );
      await db.query("select public.remove_availability_entry($1,$2,'rule')", [
        org,
        id,
      ]);
      expect(
        (
          await db.query(
            "select * from public.availability_rules where id=$1",
            [id],
          )
        ).rows,
      ).toHaveLength(0);
      expect(
        (
          await db.query(
            "select * from public.audit_logs where event='availability.removed'",
          )
        ).rows,
      ).toHaveLength(1);
    });
  });
  it("rechaza lectura y funciones de catálogo anónimas", async () => {
    await runAs(
      db,
      null,
      async () => {
        for (const table of [
          "services",
          "staff_profiles",
          "staff_services",
          "availability_rules",
          "availability_exceptions",
        ])
          await expect(
            db.query(`select * from public.${table}`),
          ).rejects.toMatchObject({ code: "42501" });
        await expect(saveService(db, org)).rejects.toMatchObject({
          code: "42501",
        });
      },
      "anon",
    );
  });
});

describe("acceso por invitación con consentimiento", () => {
  let token: string;
  it("crea token de un solo uso sin exponer hash y restringe aceptación al email", async () => {
    token = await runAs(db, accounts.owner, async () => {
      const result = await db.query<{ token: string }>(
        "select public.create_staff_invitation($1,$2,'staff@example.test') token",
        [org, staff],
      );
      await expect(
        db.query("select token_hash from public.organization_invites"),
      ).rejects.toMatchObject({ code: "42501" });
      return result.rows[0]!.token;
    });
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    await runAs(db, accounts.stranger, async () => {
      expect(
        (
          await db.query<{ data: unknown }>(
            "select public.inspect_staff_invitation($1) data",
            [token],
          )
        ).rows[0]?.data,
      ).toBeNull();
      await expect(
        db.query("select public.accept_staff_invitation($1)", [token]),
      ).rejects.toMatchObject({ code: "42501" });
    });
  });
  it("acepta con cuenta confirmada y obtiene solo el perfil vinculado", async () => {
    await runAs(db, accounts.staff, async () => {
      expect(
        (
          await db.query<{ data: { organization_name: string } }>(
            "select public.inspect_staff_invitation($1) data",
            [token],
          )
        ).rows[0]?.data.organization_name,
      ).toBe("Estudio");
      expect(
        (
          await db.query<{ id: string }>(
            "select public.accept_staff_invitation($1) id",
            [token],
          )
        ).rows[0]?.id,
      ).toBe(org);
      expect(
        (await db.query("select id from public.staff_profiles")).rows,
      ).toEqual([{ id: staff }]);
      expect(
        (await db.query("select * from public.organization_members")).rows,
      ).toHaveLength(1);
      expect(
        (await db.query("select id from public.organization_invites")).rows,
      ).toHaveLength(0);
      await expect(
        db.query("select public.accept_staff_invitation($1)", [token]),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(saveService(db, org)).rejects.toMatchObject({
        code: "42501",
      });
    });
  });
  it("permite suspender acceso de staff sin desactivar el recurso ni tocar al owner", async () => {
    const ownerProfile = await runAs(db, accounts.owner, async () => {
      await db.query("select public.set_staff_access($1,$2,false)", [
        org,
        staff,
      ]);
      return saveProfessional(db, org, [], {
        ...professionalData,
        user_id: accounts.owner,
      });
    });
    await runAs(db, accounts.staff, async () => {
      expect(
        (await db.query("select * from public.organizations")).rows,
      ).toHaveLength(0);
    });
    await runAs(db, accounts.owner, async () => {
      expect(
        (
          await db.query(
            "select is_active from public.staff_profiles where id=$1",
            [staff],
          )
        ).rows,
      ).toEqual([{ is_active: true }]);
      await expect(
        db.query("select public.set_staff_access($1,$2,false)", [
          org,
          ownerProfile,
        ]),
      ).rejects.toMatchObject({ code: "42501" });
      await db.query("select public.set_staff_access($1,$2,true)", [
        org,
        staff,
      ]);
    });
    await runAs(db, accounts.staff, async () => {
      expect(
        (await db.query("select id from public.staff_profiles")).rows,
      ).toEqual([{ id: staff }]);
    });
  });
  it("tokens revocados o vencidos no sirven y no conceden membresía", async () => {
    const { old, recent } = await runAs(db, accounts.owner, async () => {
      const profile = await saveProfessional(db, org);
      const old = (
        await db.query<{ token: string }>(
          "select public.create_staff_invitation($1,$2,'stranger@example.test') token",
          [org, profile],
        )
      ).rows[0]!.token;
      const recent = (
        await db.query<{ token: string }>(
          "select public.create_staff_invitation($1,$2,'stranger@example.test') token",
          [org, profile],
        )
      ).rows[0]!.token;
      return { old, recent };
    });
    await runAs(db, accounts.stranger, async () => {
      await expect(
        db.query("select public.accept_staff_invitation($1)", [old]),
      ).rejects.toMatchObject({ code: "42501" });
    });
    await db.query(
      "update public.organization_invites set expires_at=now()-interval '1 minute' where token_hash=encode(sha256(convert_to($1,'UTF8')),'hex')",
      [recent],
    );
    await runAs(db, accounts.stranger, async () => {
      await expect(
        db.query("select public.accept_staff_invitation($1)", [recent]),
      ).rejects.toMatchObject({ code: "42501" });
    });
  });
});
