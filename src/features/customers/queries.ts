import "server-only";
import { z } from "zod";
import { notFound } from "next/navigation";
import { requireOrganization } from "@/features/organizations/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { reportServerError } from "@/lib/errors";
import { directorySchema } from "./schema";
export async function loadCustomers(
  org: string,
  query: Record<string, string | string[] | undefined>,
) {
  const context = await requireOrganization(org);
  const filters = directorySchema.parse(query);
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("get_customer_directory", {
    p_organization_id: org,
    p_search: filters.q,
    p_activity: filters.activity,
    p_recurrence: filters.recurrence,
    p_offset: filters.page * 50,
  });
  if (error) {
    reportServerError("customers.read_failed", error);
    throw new Error("No pudimos cargar los clientes");
  }
  return { context, filters, items: data ?? [] };
}
export async function loadCustomer(org: string, id: string, page = 0) {
  const context = await requireOrganization(org);
  if (!z.uuid().safeParse(id).success) notFound();
  const client = await createSupabaseServerClient();
  const [{ data: item, error }, { data: history, error: historyError }] =
    await Promise.all([
      client
        .from("customers")
        .select(
          "id,organization_id,name,email,phone,is_active,version,created_at,updated_at",
        )
        .eq("organization_id", org)
        .eq("id", id)
        .maybeSingle(),
      client
        .from("appointments")
        .select("*")
        .eq("organization_id", org)
        .eq("customer_id", id)
        .order("starts_at", { ascending: false })
        .order("id")
        .range(page * 50, page * 50 + 49),
    ]);
  if (error || historyError) {
    reportServerError("customer.read_failed", error ?? historyError);
    throw new Error("No pudimos cargar el cliente");
  }
  if (!item) notFound();
  let preferences: null | {
    transactional_email: boolean;
    marketing_consent: boolean;
    consent_evidence: string;
    consent_updated_at: string | null;
  } = null;
  if (context.role === "owner") {
    const result = await client.rpc("get_customer_preferences", {
      p_organization_id: org,
      p_id: id,
    });
    const parsed = z
      .object({
        transactional_email: z.boolean(),
        marketing_consent: z.boolean(),
        consent_evidence: z.string(),
        consent_updated_at: z.string().nullable(),
      })
      .safeParse(result.data);
    if (result.error || !parsed.success) {
      reportServerError("customer.preferences_read_failed", result.error);
      throw new Error("No pudimos cargar las preferencias");
    }
    preferences = parsed.data;
  }
  const [visits, last] = await Promise.all([
    client
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org)
      .eq("customer_id", id)
      .eq("status", "completed"),
    client
      .from("appointments")
      .select("ends_at")
      .eq("organization_id", org)
      .eq("customer_id", id)
      .eq("status", "completed")
      .order("ends_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (visits.error || last.error) {
    reportServerError("customer.summary_failed", visits.error ?? last.error);
    throw new Error("No pudimos cargar el resumen");
  }
  return {
    context,
    item,
    preferences,
    history: history ?? [],
    summary: {
      completed_visits: visits.count ?? 0,
      last_visit: last.data?.ends_at ?? null,
    },
  };
}
