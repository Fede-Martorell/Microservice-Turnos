import "server-only";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ActionState } from "@/types/actions";
import { requireOrganization } from "@/features/organizations/queries";
import { hasOrganizationPermission } from "@/lib/permissions/organizations";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { reportServerError } from "@/lib/errors";

type RpcResult = { data: unknown; error: { code?: string } | null };
export async function catalogMutation<T>(
  org: string,
  event: string,
  schema: z.ZodType<T>,
  raw: unknown,
  execute: (
    client: SupabaseClient<Database>,
    input: T,
  ) => PromiseLike<RpcResult>,
  options?: {
    destination?: (id: string) => string;
    success?: (data: unknown) => ActionState;
  },
): Promise<ActionState> {
  const context = await requireOrganization(org);
  if (!hasOrganizationPermission(context.role, "catalog:manage"))
    return {
      message: "Solo el propietario puede modificar esta configuración",
    };
  const input = schema.safeParse(raw);
  if (!input.success)
    return {
      message: "Revisá los campos indicados",
      errors: input.error.flatten().fieldErrors as Record<
        string,
        string[] | undefined
      >,
    };
  let data: unknown;
  try {
    const client = await createSupabaseServerClient(true);
    const result = await execute(client, input.data);
    if (result.error) {
      const messages: Record<string, string> = {
        P1001:
          "El plan o período actual no habilita este cambio. Revisá Suscripción.",
        P1002:
          "Alcanzaste el cupo de profesionales activos del plan. Desactivá uno o solicitá un cambio de plan.",
        "42501": "Tu acceso cambió. Volvé al panel e intentá nuevamente.",
        "23503":
          "La selección no pertenece a este negocio o ya no está disponible.",
        "23505": "Esa cuenta ya está vinculada a otro profesional del negocio.",
        "23P01":
          "Ese intervalo se superpone con otro del mismo tipo. Editá el existente o elegí otras horas.",
        P0002: "El registro ya no está disponible. Actualizá la página.",
        P0001:
          "Alcanzaste el límite temporal de invitaciones. Intentá más tarde.",
        "22023": "La configuración no es válida para este recurso.",
      };
      if (messages[result.error.code ?? ""])
        return { message: messages[result.error.code ?? ""] };
      const reference = reportServerError(event, result.error);
      return {
        message: `No pudimos guardar los cambios. Referencia: ${reference}`,
      };
    }
    data = result.data;
  } catch (error) {
    reportServerError(event, error);
    return {
      message: "No pudimos conectar. Actualizá la página antes de reintentar.",
    };
  }
  revalidatePath(`/panel/${org}`, "layout");
  if (options?.destination) {
    const id = z.uuid().safeParse(data);
    if (!id.success)
      return {
        message: "Revisá el listado para verificar si se guardó el registro.",
      };
    redirect(options.destination(id.data));
  }
  return (
    options?.success?.(data) ?? { success: true, message: "Cambios guardados" }
  );
}
export function readFields(form: FormData, keys: string[]) {
  return Object.fromEntries(keys.map((key) => [key, form.get(key) ?? ""]));
}
export function readActive(form: FormData) {
  const value = form.get("is_active");
  return value === "on" ? "true" : (value ?? "false");
}
