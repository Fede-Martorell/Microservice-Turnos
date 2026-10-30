"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOrganization } from "@/features/organizations/queries";
import { requirePlatformAdmin } from "./queries";
import { readFields } from "@/features/services/mutation";
import { reportServerError } from "@/lib/errors";
import { parseMoney } from "@/lib/utils/money";
import {
  planSchema,
  subscriptionSchema,
  overrideSchema,
  feedbackSchema,
  organizationStatusSchema,
  trialPolicySchema,
} from "./schema";
import type { ActionState } from "@/types/actions";
import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
const bool = (form: FormData, key: string) =>
  ["on", "true"].includes(String(form.get(key)));
const versionSchema = z.number().int().positive();
async function mutate<T>(
  schema: z.ZodType<T>,
  raw: unknown,
  execute: (
    client: SupabaseClient<Database>,
    value: T,
  ) => PromiseLike<{ error: { code?: string } | null }>,
  org?: string,
): Promise<ActionState> {
  const input = schema.safeParse(raw);
  if (!input.success)
    return {
      message: "Revisá los campos indicados",
      errors: input.error.flatten().fieldErrors as Record<
        string,
        string[] | undefined
      >,
    };
  try {
    const client = await createSupabaseServerClient(true);
    const { error } = await execute(client, input.data);
    if (error) {
      const messages: Record<string, string> = {
        "42501": "Tu acceso cambió. Volvé a ingresar.",
        "40001": "Los datos cambiaron. Actualizá la página antes de guardar.",
        "23505":
          "Ese código o excepción ya existe. Editá el registro existente.",
        "22023":
          "Revisá el período (máximo 367 días), el plan y los módulos seleccionados.",
        "23514": "Los valores no cumplen los límites indicados.",
        P1001: "El plan no habilita esta operación. Consultá Suscripción.",
        P1002:
          "Se alcanzó el límite. Para bajar de plan, desactivá los profesionales que exceden su cupo; el feedback admite 5 envíos por día.",
      };
      if (messages[error.code ?? ""])
        return { message: messages[error.code ?? ""] };
      reportServerError("subscription.write_failed", error);
      return { message: "No pudimos guardar los cambios" };
    }
  } catch (error) {
    reportServerError("subscription.write_failed", error);
    return { message: "No pudimos conectar. Actualizá antes de reintentar." };
  }
  revalidatePath("/admin", "layout");
  revalidatePath("/panel", "layout");
  if (org) revalidatePath(`/panel/${org}`, "layout");
  revalidatePath("/b", "layout");
  return { success: true, message: "Cambios guardados" };
}
export async function savePlanAction(
  code: string | null,
  version: number | null,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requirePlatformAdmin();
  if (version !== null && !versionSchema.safeParse(version).success)
    return { message: "Actualizá el plan" };
  return mutate(
    planSchema,
    {
      ...readFields(form, [
        "name",
        "description",
        "price",
        "currency",
        "max_professionals",
      ]),
      code: code ?? form.get("code"),
      is_active: bool(form, "is_active"),
      modules: form.getAll("modules"),
    },
    (client, v) =>
      client.rpc("admin_save_plan", {
        p_code: v.code,
        p_version: version,
        p_data: {
          name: v.name,
          description: v.description,
          price_minor: parseMoney(v.price, v.currency)!,
          currency: v.currency,
          max_professionals: v.max_professionals,
          is_active: v.is_active,
        },
        p_modules: v.modules,
      }),
  );
}
export async function saveModulePriceAction(
  module: string,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requirePlatformAdmin();
  const schema = z
    .object({
      module: z.string().min(2).max(40),
      price: z.string(),
      currency: z.string().regex(/^[A-Z]{3}$/),
    })
    .superRefine((v, c) => {
      if (parseMoney(v.price, v.currency) === null)
        c.addIssue({
          code: "custom",
          path: ["price"],
          message: "Importe o moneda inválidos",
        });
    });
  return mutate(
    schema,
    { module, ...readFields(form, ["price", "currency"]) },
    (client, v) =>
      client.rpc("admin_save_module_price", {
        p_module: v.module,
        p_price_minor: parseMoney(v.price, v.currency)!,
        p_currency: v.currency,
      }),
  );
}
export async function saveSubscriptionAction(
  org: string,
  version: number,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requirePlatformAdmin();
  if (
    !z.uuid().safeParse(org).success ||
    !versionSchema.safeParse(version).success
  )
    return { message: "Actualizá el negocio" };
  return mutate(
    subscriptionSchema,
    readFields(form, [
      "plan",
      "status",
      "starts_on",
      "ends_on",
      "reason",
      "notes",
    ]),
    (client, v) =>
      client.rpc("admin_save_subscription", {
        p_organization_id: org,
        p_version: version,
        p_plan: v.plan,
        p_status: v.status,
        p_starts_on: v.starts_on,
        p_ends_on: v.ends_on,
        p_reason: v.reason,
        p_notes: v.notes,
      }),
    org,
  );
}
export async function saveModuleAction(
  org: string,
  module: string | null,
  version: number | null,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requirePlatformAdmin();
  if (
    !z.uuid().safeParse(org).success ||
    (version !== null && !versionSchema.safeParse(version).success)
  )
    return { message: "Actualizá el negocio" };
  return mutate(
    overrideSchema,
    {
      ...readFields(form, ["starts_on", "ends_on", "reason"]),
      module: module ?? form.get("module"),
      enabled: bool(form, "enabled"),
    },
    (client, v) =>
      client.rpc("admin_save_module", {
        p_organization_id: org,
        p_module: v.module,
        p_version: version,
        p_enabled: v.enabled,
        p_starts_on: v.starts_on,
        p_ends_on: v.ends_on,
        p_reason: v.reason,
      }),
    org,
  );
}
export async function saveOrganizationStatusAction(
  org: string,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requirePlatformAdmin();
  if (!z.uuid().safeParse(org).success) return { message: "Negocio inválido" };
  return mutate(
    organizationStatusSchema,
    readFields(form, ["status", "reason"]),
    (client, v) =>
      client.rpc("admin_set_organization_status", {
        p_organization_id: org,
        p_status: v.status,
        p_reason: v.reason,
      }),
    org,
  );
}
export async function saveTrialPolicyAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requirePlatformAdmin();
  return mutate(
    trialPolicySchema,
    readFields(form, ["plan", "days"]),
    (client, v) =>
      client.rpc("admin_save_trial_policy", { p_plan: v.plan, p_days: v.days }),
  );
}
export async function saveFeedbackAction(
  org: string,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const context = await requireOrganization(org);
  if (context.role !== "owner")
    return { message: "Solo el propietario puede enviar feedback" };
  return mutate(
    feedbackSchema,
    readFields(form, [
      "problems",
      "difficulty",
      "requests",
      "perceived_value",
      "willing_to_pay",
      "suggestions",
    ]),
    (client, v) =>
      client.rpc("save_pilot_feedback", { p_organization_id: org, p_data: v }),
    org,
  );
}
