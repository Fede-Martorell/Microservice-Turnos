"use server";
import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganization } from "@/features/organizations/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { publicBookingConfig } from "@/lib/public-booking/config";
import { reportServerError } from "@/lib/errors";
import { readFields } from "@/features/services/mutation";
import {
  programSchema,
  rewardInputSchema,
  adjustmentSchema,
  reasonSchema,
} from "./schema";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ActionState } from "@/types/actions";
const bool = (form: FormData, key: string) =>
  ["on", "true"].includes(String(form.get(key)));
const version = z.number().int().positive();
async function mutation<T>(
  org: string,
  schema: z.ZodType<T>,
  raw: unknown,
  execute: (
    client: SupabaseClient<Database>,
    value: T,
  ) => PromiseLike<{ error: { code?: string } | null }>,
  success?: () => ActionState,
): Promise<ActionState> {
  const context = await requireOrganization(org);
  if (context.role !== "owner")
    return { message: "Solo el propietario puede gestionar Fidelización" };
  const parsed = schema.safeParse(raw);
  if (!parsed.success)
    return {
      message:
        parsed.error.issues.find((issue) => issue.path[0] === "services")
          ?.message ?? "Revisá los campos indicados",
      errors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[] | undefined
      >,
    };
  try {
    const client = await createSupabaseServerClient(true);
    const { error } = await execute(client, parsed.data);
    if (error) {
      const messages: Record<string, string> = {
        P1001:
          "El acceso actual no incluye Fidelización. Revisá Suscripción o consultá a la administración.",
        P2001:
          "El saldo disponible no alcanza. Los créditos vencidos no se pueden usar.",
        P2002:
          "Se alcanzó un límite de saldo, uso o fragmentación. Revisá las condiciones y el historial.",
        P2003:
          "El programa ya tiene movimientos: conservá su modalidad para proteger el historial.",
        "40001": "Los datos cambiaron. Actualizá antes de continuar.",
        "42501": "Tu acceso cambió. Volvé a ingresar.",
        "22023":
          "Revisá las fechas, servicios y condiciones. La solicitud puede haber sido usada o el canje ya estar anulado.",
        "23503": "La selección no pertenece a este negocio.",
        "23514": "Los valores no cumplen los límites indicados.",
      };
      if (messages[error.code ?? ""])
        return { message: messages[error.code ?? ""] };
      reportServerError("loyalty.write_failed", error);
      return {
        message:
          "No pudimos guardar el cambio. Actualizá para comprobar su estado antes de reintentar.",
      };
    }
  } catch (error) {
    reportServerError("loyalty.write_failed", error);
    return {
      message:
        "No pudimos conectar. Actualizá para comprobar el estado antes de reintentar.",
    };
  }
  revalidatePath(`/panel/${org}`, "layout");
  return (
    success?.() ?? { success: true, message: "Cambio de fidelización guardado" }
  );
}
export async function saveLoyaltyProgramAction(
  org: string,
  currentVersion: number | null,
  mode: string,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const earnings: Record<string, number> = {};
  if (mode === "visits")
    for (const id of form.getAll("service_ids")) earnings[String(id)] = 1;
  else
    for (const [key, value] of form.entries())
      if (key.startsWith("earn_") && Number(value) !== 0)
        earnings[key.slice(5)] = Number(value);
  const result = await mutation(
    org,
    programSchema,
    {
      ...readFields(form, [
        "name",
        "starts_on",
        "ends_on",
        "conditions",
        "expire_days",
        "reset_mode",
      ]),
      mode,
      is_active: bool(form, "is_active"),
      services: earnings,
    },
    (client, v) => {
      if (currentVersion !== null && !version.safeParse(currentVersion).success)
        return Promise.resolve({ error: { code: "40001" } });
      const { services, ...data } = v;
      return client.rpc("save_loyalty_program", {
        p_organization_id: org,
        p_version: currentVersion,
        p_data: data,
        p_services: services,
      });
    },
  );
  if (result.success) redirect(`/panel/${org}/fidelizacion`);
  return result;
}
export async function setLoyaltyActiveAction(
  org: string,
  currentVersion: number,
  active: boolean,
  _state: ActionState,
  _form: FormData,
): Promise<ActionState> {
  void _form;
  return mutation(
    org,
    z.object({ version, active: z.boolean() }),
    { version: currentVersion, active },
    (client, v) =>
      client.rpc("set_loyalty_program_active", {
        p_organization_id: org,
        p_version: v.version,
        p_active: v.active,
      }),
  );
}
export async function saveLoyaltyRewardAction(
  org: string,
  id: string | null,
  currentVersion: number | null,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const result = await mutation(
    org,
    rewardInputSchema.safeExtend({
      id: z.uuid().nullable(),
      version: version.nullable(),
    }),
    {
      ...readFields(form, [
        "name",
        "benefit",
        "cost",
        "conditions",
        "starts_on",
        "ends_on",
        "per_customer_limit",
        "total_limit",
      ]),
      is_active: bool(form, "is_active"),
      id,
      version: currentVersion,
    },
    (client, v) => {
      const { id: target, version: ver, ...data } = v;
      return client.rpc("save_loyalty_reward", {
        p_organization_id: org,
        p_id: target,
        p_version: ver,
        p_data: data,
      });
    },
  );
  if (result.success) redirect(`/panel/${org}/fidelizacion`);
  return result;
}
export async function adjustLoyaltyAction(
  org: string,
  customer: string,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  return mutation(
    org,
    adjustmentSchema.extend({ customer: z.uuid() }),
    {
      ...readFields(form, ["amount", "reason", "reference", "request_key"]),
      customer,
    },
    (client, v) =>
      client.rpc("adjust_loyalty_balance", {
        p_organization_id: org,
        p_customer_id: v.customer,
        p_amount: v.amount,
        p_reason: v.reason,
        p_reference: v.reference || null,
        p_request_key: v.request_key,
      }),
  );
}
export async function redeemLoyaltyAction(
  org: string,
  customer: string,
  reward: string,
  rewardVersion: number,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  return mutation(
    org,
    z.object({
      customer: z.uuid(),
      reward: z.uuid(),
      version,
      request_key: z.uuid(),
    }),
    {
      customer,
      reward,
      version: rewardVersion,
      request_key: form.get("request_key"),
    },
    (client, v) =>
      client.rpc("redeem_loyalty_reward", {
        p_organization_id: org,
        p_customer_id: v.customer,
        p_reward_id: v.reward,
        p_reward_version: v.version,
        p_request_key: v.request_key,
      }),
  );
}
export async function voidLoyaltyAction(
  org: string,
  redemption: string,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  return mutation(
    org,
    z.object({
      redemption: z.uuid(),
      reason: reasonSchema,
      request_key: z.uuid(),
    }),
    { ...readFields(form, ["reason", "request_key"]), redemption },
    (client, v) =>
      client.rpc("void_loyalty_redemption", {
        p_organization_id: org,
        p_redemption_id: v.redemption,
        p_reason: v.reason,
        p_request_key: v.request_key,
      }),
  );
}
export async function issueLoyaltyCardAction(
  org: string,
  customer: string,
  _state: ActionState,
  _form: FormData,
): Promise<ActionState> {
  void _form;
  const config = publicBookingConfig();
  if (!config || (!config.local && !config.secure))
    return {
      message:
        "Falta configurar el acceso privado del servidor y HTTPS para hosting.",
    };
  const token = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(token).digest("hex");
  return mutation(
    org,
    z.uuid(),
    customer,
    (client, id) =>
      client.rpc("issue_loyalty_card", {
        p_organization_id: org,
        p_customer_id: id,
        p_token_hash: hash,
      }),
    () => ({
      success: true,
      message:
        "Tarjeta emitida. El enlace anterior dejó de funcionar. No se envió ningún email.",
      link: new URL(`/tarjeta#token=${token}`, config.origin).toString(),
    }),
  );
}
export async function revokeLoyaltyCardAction(
  org: string,
  customer: string,
  _state: ActionState,
  _form: FormData,
): Promise<ActionState> {
  void _form;
  return mutation(org, z.uuid(), customer, (client, id) =>
    client.rpc("revoke_loyalty_card", {
      p_organization_id: org,
      p_customer_id: id,
    }),
  );
}
