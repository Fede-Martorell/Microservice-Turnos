"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { organizationIdSchema, organizationSchema } from "./schema";
import { requireOrganization } from "./queries";
import { hasOrganizationPermission } from "@/lib/permissions/organizations";
import { reportServerError } from "@/lib/errors";
import type { ActionState } from "@/types/actions";

function readOrganization(form: FormData) {
  return organizationSchema.safeParse(
    Object.fromEntries(
      ["name", "slug", "description", "timezone", "currency"].map((key) => [
        key,
        form.get(key),
      ]),
    ),
  );
}

export async function createOrganizationAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireUser();
  const input = readOrganization(form);
  if (!input.success)
    return {
      errors: input.error.flatten().fieldErrors,
      message: "Revisá los campos indicados",
    };
  const supabase = await createSupabaseServerClient(true);
  let organizationId: string;
  try {
    const { data, error } = await supabase.rpc("create_organization", {
      p_name: input.data.name,
      p_slug: input.data.slug,
      p_description: input.data.description,
      p_timezone: input.data.timezone,
      p_currency: input.data.currency,
    });
    if (error) {
      if (error.code === "23505")
        return {
          errors: { slug: ["Ese identificador ya está en uso"] },
          message: "Elegí otro identificador para tu negocio",
        };
      if (error.code === "P0001")
        return {
          message:
            "Alcanzaste el límite de 3 organizaciones nuevas por día. Intentá más tarde.",
        };
      const reference = reportServerError("organizations.create_failed", error);
      return {
        message: `No pudimos crear la organización. Referencia: ${reference}`,
      };
    }
    if (!organizationIdSchema.safeParse(data).success)
      return {
        message:
          "No pudimos verificar la creación. Revisá tu panel antes de reintentar.",
      };
    organizationId = data;
  } catch (error) {
    reportServerError("organizations.create_unavailable", error);
    return {
      message: "No pudimos conectar. Revisá tu panel antes de reintentar.",
    };
  }
  revalidatePath("/panel");
  redirect(`/panel/${organizationId}`);
}

export async function updateOrganizationAction(
  organizationId: string,
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const context = await requireOrganization(organizationId);
  if (!hasOrganizationPermission(context.role, "organization:update"))
    return { message: "Solo el propietario puede modificar la organización" };
  const input = readOrganization(form);
  if (!input.success)
    return {
      errors: input.error.flatten().fieldErrors,
      message: "Revisá los campos indicados",
    };
  const supabase = await createSupabaseServerClient(true);
  try {
    const { error, data } = await supabase
      .from("organizations")
      .update({
        name: input.data.name,
        description: input.data.description,
        timezone: input.data.timezone,
        currency: input.data.currency,
      })
      .eq("id", context.organization.id)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      reportServerError("organizations.update_failed", error);
      return {
        message:
          "No pudimos guardar los cambios. Revisá tu acceso e intentá nuevamente.",
      };
    }
  } catch (error) {
    reportServerError("organizations.update_unavailable", error);
    return { message: "No pudimos conectar. Intentá nuevamente." };
  }
  revalidatePath(`/panel/${organizationId}`);
  revalidatePath(`/panel/${organizationId}/configuracion`);
  revalidatePath("/panel");
  return { success: true, message: "Cambios guardados" };
}
