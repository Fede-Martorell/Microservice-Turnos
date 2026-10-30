import { it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import {
  createTestDatabase,
  createOrganization,
  accounts,
  runAs,
  saveProfessional,
  saveService,
} from "../helpers/database";

it("recupera datos, funciones y permisos desde una copia PGlite descartable; no certifica backups de Supabase", async () => {
  const original = await createTestDatabase("20261030001200");
  let restored: PGlite | undefined;
  try {
    const org = await createOrganization(
      original,
      accounts.owner,
      "recuperacion",
    );
    let staff = "";
    await runAs(original, accounts.owner, async () => {
      staff = await saveProfessional(original, org);
      await saveService(original, org, [staff]);
    });
    const snapshot = await original.dumpDataDir("none");
    await original.query(
      "update public.services set is_active=false where organization_id=$1",
      [org],
    );
    restored = await PGlite.create({
      loadDataDir: snapshot,
      extensions: { btree_gist },
    });
    const copy = restored;
    const state = await runAs(copy, accounts.owner, () =>
      copy.query<{ v: { service_ready: boolean } }>(
        "select public.get_business_onboarding($1) v",
        [org],
      ),
    );
    expect(state.rows[0]!.v.service_ready).toBe(true);
    expect(
      (
        await original.query<{ is_active: boolean }>(
          "select is_active from public.services where organization_id=$1",
          [org],
        )
      ).rows[0]!.is_active,
    ).toBe(false);
    const outsider = await runAs(copy, accounts.other, () =>
      copy.query("select id from public.organizations where id=$1", [org]),
    );
    expect(outsider.rows).toEqual([]);
    await expect(
      runAs(copy, accounts.other, () =>
        copy.query("select public.get_business_onboarding($1)", [org]),
      ),
    ).rejects.toThrow(/Forbidden/);
    await expect(
      runAs(
        copy,
        null,
        () => copy.query("select public.get_business_onboarding($1)", [org]),
        "anon",
      ),
    ).rejects.toThrow(/permission denied/);
  } finally {
    await restored?.close();
    await original.close();
  }
}, 30_000);
