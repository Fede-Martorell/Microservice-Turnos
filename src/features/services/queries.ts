import "server-only";
import { requireOrganization } from "@/features/organizations/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { reportServerError } from "@/lib/errors";
import { readMany } from "@/lib/supabase/read-many";

export async function loadCatalog(org: string) {
  const context = await requireOrganization(org);
  const client = await createSupabaseServerClient();
  const [
    services,
    professionals,
    assignments,
    rules,
    exceptions,
    members,
    invitations,
  ] = await Promise.all([
    readMany((from, to) =>
      client
        .from("services")
        .select("*")
        .eq("organization_id", org)
        .order("name")
        .order("id")
        .range(from, to),
    ),
    readMany((from, to) =>
      client
        .from("staff_profiles")
        .select("*")
        .eq("organization_id", org)
        .order("name")
        .order("id")
        .range(from, to),
    ),
    readMany((from, to) =>
      client
        .from("staff_services")
        .select("*")
        .eq("organization_id", org)
        .order("staff_id")
        .order("service_id")
        .range(from, to),
    ),
    readMany((from, to) =>
      client
        .from("availability_rules")
        .select("*")
        .eq("organization_id", org)
        .order("weekday")
        .order("start_minute")
        .order("id")
        .range(from, to),
    ),
    readMany((from, to) =>
      client
        .from("availability_exceptions")
        .select("*")
        .eq("organization_id", org)
        .order("starts_on", { ascending: false })
        .order("id")
        .range(from, to),
    ),
    context.role === "owner"
      ? readMany((from, to) =>
          client
            .from("organization_members")
            .select("*")
            .eq("organization_id", org)
            .order("user_id")
            .range(from, to),
        )
      : Promise.resolve({ data: [], error: null }),
    context.role === "owner"
      ? readMany((from, to) =>
          client
            .from("organization_invites")
            .select(
              "id,organization_id,staff_id,email,invited_by,expires_at,accepted_at,revoked_at,created_at",
            )
            .eq("organization_id", org)
            .order("created_at", { ascending: false })
            .order("id")
            .range(from, to),
        )
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const response of [
    services,
    professionals,
    assignments,
    rules,
    exceptions,
    members,
    invitations,
  ])
    if (response.error) {
      reportServerError("catalog.read_failed", response.error);
      throw new Error("No pudimos cargar la configuración del negocio");
    }
  return {
    context,
    services: services.data ?? [],
    professionals: professionals.data ?? [],
    assignments: assignments.data ?? [],
    rules: rules.data ?? [],
    exceptions: exceptions.data ?? [],
    members: members.data ?? [],
    invitations: invitations.data ?? [],
  };
}
