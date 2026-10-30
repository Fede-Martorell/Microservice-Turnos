"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganization } from "@/features/organizations/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readFields, readActive } from "@/features/services/mutation";
import { reportServerError } from "@/lib/errors";
import { customerSchema, preferencesSchema } from "./schema";
import type { ActionState } from "@/types/actions";
export async function saveCustomerAction(
  org: string,
  id: string | null,
  version: number | null,
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const context = await requireOrganization(org);
  if (context.role !== "owner")
    return { message: "Solo el propietario puede editar clientes" };
  const input = customerSchema.safeParse({
    ...readFields(form, ["name", "email", "phone"]),
    is_active: readActive(form),
  });
  if (!input.success)
    return {
      message: "Revisá los campos indicados",
      errors: input.error.flatten().fieldErrors,
    };
  if (
    (id && !z.uuid().safeParse(id).success) ||
    (id && !z.number().int().positive().safeParse(version).success)
  )
    return { message: "Actualizá la ficha antes de continuar" };
  let result: string | null = null;
  try {
    const client = await createSupabaseServerClient(true);
    const { data, error } = await client.rpc("save_customer", {
      p_organization_id: org,
      p_id: id,
      p_version: version,
      p_data: input.data,
    });
    if (error) {
      if (error.code === "P1001")
        return {
          message:
            "El acceso actual no habilita cambios en Clientes. Revisá Suscripción.",
        };
      if (error.code === "23505")
        return {
          message:
            "Ya existe un cliente con ese email en este negocio. Buscalo en el listado.",
        };
      if (error.code === "40001")
        return { message: "La ficha cambió. Actualizá antes de guardar." };
      if (error.code === "42501")
        return { message: "Tu acceso cambió. Volvé al panel." };
      reportServerError("customer.save_failed", error);
      return { message: "No pudimos guardar la ficha" };
    }
    result = data;
  } catch (error) {
    reportServerError("customer.save_failed", error);
    return { message: "No pudimos conectar. Actualizá antes de reintentar." };
  }
  revalidatePath(`/panel/${org}`, "layout");
  if (!id && result) redirect(`/panel/${org}/clientes/${result}`);
  return { success: true, message: "Cliente guardado" };
}
export async function saveCustomerPreferencesAction(
  org: string,
  id: string,
  version: number,
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const context = await requireOrganization(org);
  if (context.role !== "owner")
    return { message: "Solo el propietario puede registrar preferencias" };
  const bool = (key: string) =>
    ["on", "true"].includes(String(form.get(key))) ? "true" : "false";
  const input = preferencesSchema.safeParse({
    ...readFields(form, ["consent_evidence"]),
    transactional_email: bool("transactional_email"),
    marketing_consent: bool("marketing_consent"),
  });
  if (!input.success)
    return {
      message: "Revisá las preferencias",
      errors: input.error.flatten().fieldErrors,
    };
  if (
    !z.uuid().safeParse(id).success ||
    !z.number().int().positive().safeParse(version).success
  )
    return { message: "Actualizá la ficha antes de continuar" };
  try {
    const client = await createSupabaseServerClient(true);
    const { error } = await client.rpc("save_customer_preferences", {
      p_organization_id: org,
      p_id: id,
      p_version: version,
      p_transactional: input.data.transactional_email,
      p_marketing: input.data.marketing_consent,
      p_evidence: input.data.consent_evidence,
    });
    if (error) {
      if (error.code === "40001")
        return { message: "La ficha cambió. Actualizá antes de guardar." };
      reportServerError("customer.preferences_failed", error);
      return { message: "No pudimos guardar las preferencias" };
    }
  } catch (error) {
    reportServerError("customer.preferences_failed", error);
    return { message: "No pudimos conectar. Volvé a intentar." };
  }
  revalidatePath(`/panel/${org}`, "layout");
  return { success: true, message: "Preferencias registradas" };
}
