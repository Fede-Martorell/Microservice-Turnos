import "server-only";
import { cache } from "react";
import { z } from "zod";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { requireOrganization } from "@/features/organizations/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { publicGateway } from "@/lib/public-booking/gateway";
import { reportServerError } from "@/lib/errors";
import { readMany } from "@/lib/supabase/read-many";
import { requestPublicResult } from "@/features/public-booking/queries";
import {
  configSchema,
  customerLoyaltySchema,
  cardSchema,
  cardCookie,
} from "./schema";
export const requireLoyaltyOwner = cache(async (org: string) => {
  const context = await requireOrganization(org);
  if (context.role !== "owner") notFound();
  return context;
});
export const loadLoyaltyConfig = cache(async (org: string) => {
  const context = await requireLoyaltyOwner(org);
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("get_loyalty_config", {
    p_organization_id: org,
  });
  if (error) {
    reportServerError("loyalty.config_failed", error);
    throw new Error(
      "No pudimos cargar Fidelización. Verificá la migración de etapa 7.",
    );
  }
  return { context, ...configSchema.parse(data) };
});
export async function loadLoyaltyServices(org: string) {
  await requireLoyaltyOwner(org);
  const client = await createSupabaseServerClient();
  const { data, error } = await readMany((from, to) =>
    client
      .from("services")
      .select("id,name,is_active")
      .eq("organization_id", org)
      .order("name")
      .order("id")
      .range(from, to),
  );
  if (error) {
    reportServerError("loyalty.services_failed", error);
    throw new Error("No pudimos cargar los servicios");
  }
  return data ?? [];
}
export async function loadLoyaltyAccounts(
  org: string,
  search: string,
  page: number,
) {
  await requireLoyaltyOwner(org);
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("get_loyalty_accounts", {
    p_organization_id: org,
    p_search: search,
    p_offset: page * 50,
  });
  if (error) {
    reportServerError("loyalty.accounts_failed", error);
    throw new Error("No pudimos cargar las tarjetas");
  }
  return z
    .array(
      z.object({
        customer_id: z.uuid(),
        name: z.string(),
        is_active: z.boolean(),
        balance: z.number(),
      }),
    )
    .parse(data);
}
export async function loadLoyaltyCustomer(
  org: string,
  id: string,
  page: number,
) {
  const context = await requireLoyaltyOwner(org);
  if (!z.uuid().safeParse(id).success) notFound();
  const client = await createSupabaseServerClient();
  const [customer, loyalty] = await Promise.all([
    client
      .from("customers")
      .select("id,name,is_active")
      .eq("organization_id", org)
      .eq("id", id)
      .maybeSingle(),
    client.rpc("get_loyalty_customer", {
      p_organization_id: org,
      p_customer_id: id,
      p_offset: page * 50,
    }),
  ]);
  if (!customer.error && !customer.data) notFound();
  if (customer.error || loyalty.error) {
    reportServerError(
      "loyalty.customer_failed",
      customer.error ?? loyalty.error,
    );
    throw new Error("No pudimos cargar la fidelización del cliente");
  }
  return {
    context,
    customer: customer.data!,
    ...customerLoyaltySchema.parse(loyalty.data),
  };
}
export async function loadLoyaltyCard() {
  const gateway = await publicGateway();
  if (!gateway || (!gateway.config.local && !gateway.config.secure))
    return { value: null, code: "offline" };
  const token = (await cookies()).get(cardCookie)?.value;
  if (!token || !/^[0-9a-f]{64}$/.test(token))
    return { value: null, code: "not_found" };
  return requestPublicResult(
    () =>
      gateway.client.rpc("get_loyalty_card", {
        p_token: token,
        p_visitor: gateway.visitor,
      }),
    cardSchema,
    "card",
  );
}
