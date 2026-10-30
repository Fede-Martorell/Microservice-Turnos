import "server-only";
import { notFound } from "next/navigation";
import { requireOrganization } from "@/features/organizations/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { reportServerError } from "@/lib/errors";
import { dashboardSchema, periodSchema } from "./schema";

export async function loadBusinessDashboard(
  org: string,
  period: { from: string; to: string },
) {
  const context = await requireOrganization(org);
  if (context.role !== "owner") notFound();
  const valid = periodSchema.parse(period);
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("get_business_dashboard", {
    p_organization_id: org,
    p_from: valid.from,
    p_to: valid.to,
  });
  const parsed = dashboardSchema.safeParse(data);
  if (error || !parsed.success) {
    reportServerError(
      "dashboard.read_failed",
      error ?? { code: "INVALID_CONTRACT" },
    );
    throw new Error("No pudimos cargar el resumen del negocio");
  }
  return parsed.data;
}
