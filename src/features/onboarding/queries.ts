import "server-only";
import { notFound } from "next/navigation";
import { requireOrganization } from "@/features/organizations/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { reportServerError } from "@/lib/errors";
import { onboardingSchema } from "./schema";

export async function loadBusinessOnboarding(org: string) {
  if ((await requireOrganization(org)).role !== "owner") notFound();
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("get_business_onboarding", {
    p_organization_id: org,
  });
  const parsed = onboardingSchema.safeParse(data);
  if (error || !parsed.success) {
    reportServerError(
      "onboarding.read_failed",
      error ?? { code: "INVALID_CONTRACT" },
    );
    throw new Error("No pudimos revisar la configuración del negocio");
  }
  return parsed.data;
}
