import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { organizationIdSchema } from "./schema";
import { reportServerError } from "@/lib/errors";

export async function listOrganizations() {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) {
    reportServerError("organizations.list_failed", error);
    throw new Error("No pudimos cargar tus organizaciones");
  }
  return data;
}

export const requireOrganization = cache(async (organizationId: string) => {
  const user = await requireUser();
  if (!organizationIdSchema.safeParse(organizationId).success) notFound();
  const supabase = await createSupabaseServerClient();
  const [
    { data: organization, error: organizationError },
    { data: membership, error: membershipError },
  ] = await Promise.all([
    supabase
      .from("organizations")
      .select("*")
      .eq("id", organizationId)
      .maybeSingle(),
    supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle(),
  ]);
  if (organizationError || membershipError) {
    reportServerError(
      "organizations.access_failed",
      organizationError ?? membershipError,
    );
    throw new Error("No pudimos verificar el acceso a la organización");
  }
  if (!organization || !membership || organization.status !== "active")
    notFound();
  return { user, organization, role: membership.role };
});
