import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { requireOrganization } from "@/features/organizations/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { reportServerError } from "@/lib/errors";
import { statusSchema } from "./schema";
const plan = z.object({
  code: z.string(),
  name: z.string(),
  description: z.string(),
  price_minor: z.number(),
  currency: z.string(),
  max_professionals: z.number(),
  is_active: z.boolean(),
  version: z.number(),
});
const subscription = z.object({
  organization_id: z.uuid(),
  plan_code: z.string(),
  status: statusSchema,
  starts_at: z.string(),
  ends_at: z.string(),
  quoted_price_minor: z.number(),
  quoted_currency: z.string(),
  version: z.number(),
});
const override = z.object({
  organization_id: z.uuid(),
  module_code: z.string(),
  enabled: z.boolean(),
  starts_at: z.string(),
  ends_at: z.string(),
  reason: z.string(),
  version: z.number(),
});
const access = z.object({
  plan,
  subscription,
  can_write: z.boolean(),
  modules: z.array(z.string()),
  active_professionals: z.number(),
});
const adminOrganization = z.object({
  organization: z.object({
    id: z.uuid(),
    name: z.string(),
    slug: z.string(),
    status: z.enum(["active", "suspended", "archived"]),
    timezone: z.string(),
  }),
  subscription,
  active_professionals: z.number(),
  overrides: z.array(override),
  notes: z.string(),
});
const listing = z.array(
  z.object({
    id: z.uuid(),
    name: z.string(),
    slug: z.string(),
    status: z.string(),
    plan_code: z.string(),
    subscription_status: statusSchema,
    starts_at: z.string(),
    ends_at: z.string(),
    active_professionals: z.number(),
  }),
);
export const isPlatformAdmin = cache(async () => {
  await requireUser();
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("get_platform_admin_context", {});
  if (error) {
    reportServerError("platform.access_failed", error);
    return false;
  }
  return data === true;
});
export async function requirePlatformAdmin() {
  if (!(await isPlatformAdmin())) notFound();
}
function checked<T>(
  result: { data: T | null; error: unknown },
  event: string,
): NonNullable<T> {
  if (result.error || result.data === null) {
    reportServerError(event, result.error);
    throw new Error(
      "No pudimos cargar la suscripción. Verificá las migraciones de etapa 6.",
    );
  }
  return result.data as NonNullable<T>;
}
export const getOrganizationAccess = cache(async (org: string) => {
  await requireOrganization(org);
  const client = await createSupabaseServerClient();
  return access.parse(
    checked(
      await client.rpc("get_organization_access", { p_organization_id: org }),
      "subscription.read_failed",
    ),
  );
});
export async function loadPlanCatalog() {
  await requireUser();
  const client = await createSupabaseServerClient();
  const [plans, modules, entitlements] = await Promise.all([
    client.from("subscription_plans").select("*").order("price_minor"),
    client.from("module_catalog").select("*").order("code"),
    client.from("plan_entitlements").select("*"),
  ]);
  return {
    plans: checked(plans, "plans.read_failed"),
    modules: checked(modules, "modules.read_failed"),
    entitlements: checked(entitlements, "entitlements.read_failed"),
  };
}
export async function loadAdminHome(search: string, offset: number) {
  await requirePlatformAdmin();
  const client = await createSupabaseServerClient();
  const [overview, organizations] = await Promise.all([
    client.rpc("admin_overview", {}),
    client.rpc("admin_list_organizations", {
      p_search: search,
      p_offset: offset,
    }),
  ]);
  return {
    overview: z
      .object({
        organizations: z.number(),
        active_access: z.number(),
        pilots: z.number(),
        expired: z.number(),
      })
      .parse(checked(overview, "platform.overview_failed")),
    organizations: listing.parse(
      checked(organizations, "platform.list_failed"),
    ),
  };
}
export async function loadAdminOrganization(org: string) {
  await requirePlatformAdmin();
  if (!z.uuid().safeParse(org).success) notFound();
  const client = await createSupabaseServerClient();
  const result = await client.rpc("admin_get_organization", {
    p_organization_id: org,
  });
  if (!result.error && !result.data) notFound();
  const [feedback, audit] = await Promise.all([
    client
      .from("pilot_feedback")
      .select("*")
      .eq("organization_id", org)
      .order("created_at", { ascending: false })
      .limit(20),
    client
      .from("platform_audit_logs")
      .select("*")
      .eq("organization_id", org)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  return {
    detail: adminOrganization.parse(
      checked(result, "platform.organization_failed"),
    ),
    feedback: checked(feedback, "platform.feedback_failed"),
    audit: checked(audit, "platform.audit_failed"),
  };
}
export async function loadTrialPolicy() {
  await requirePlatformAdmin();
  const client = await createSupabaseServerClient();
  return z
    .object({ default_plan_code: z.string(), trial_days: z.number() })
    .parse(
      checked(
        await client
          .from("platform_access_settings")
          .select("*")
          .eq("singleton", true)
          .single(),
        "platform.policy_failed",
      ),
    );
}
export async function loadPlatformAudit() {
  await requirePlatformAdmin();
  const client = await createSupabaseServerClient();
  return checked(
    await client
      .from("platform_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
    "platform.audit_failed",
  );
}
