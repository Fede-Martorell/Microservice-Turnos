"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { reportServerError } from "@/lib/errors";
import { invitationTokenSchema } from "./schema";
import type { ActionState } from "@/types/actions";

export async function acceptInvitationAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireUser();
  const token = invitationTokenSchema.safeParse(form.get("token"));
  if (!token.success) return { message: "La invitación no es válida." };
  let organizationId: string;
  try {
    const client = await createSupabaseServerClient(true);
    const { data, error } = await client.rpc("accept_staff_invitation", {
      p_token: token.data,
    });
    if (error) {
      if (error.code === "23505")
        return {
          message:
            "Tu cuenta ya tiene un perfil en este negocio. Pedile al propietario que revise la vinculación.",
        };
      if (["42501", "P0002", "22023"].includes(error.code))
        return {
          message:
            "La invitación venció, fue revocada o corresponde a otro correo. Ingresá con la cuenta invitada o pedí un enlace nuevo.",
        };
      reportServerError("invitation.accept_failed", error);
      return {
        message: "No pudimos aceptar la invitación. Intentá nuevamente.",
      };
    }
    const id = z.uuid().safeParse(data);
    if (!id.success)
      return { message: "Revisá Mis organizaciones para verificar tu acceso." };
    organizationId = id.data;
  } catch (error) {
    reportServerError("invitation.accept_failed", error);
    return {
      message: "No pudimos conectar. Actualizá la página antes de reintentar.",
    };
  }
  revalidatePath("/panel", "layout");
  redirect(`/panel/${organizationId}`);
}
