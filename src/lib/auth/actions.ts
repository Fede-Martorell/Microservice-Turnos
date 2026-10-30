"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabaseConfiguration } from "@/lib/config/environment.server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loginSchema, registrationSchema } from "./schema";
import { requireUser } from "./session";
import { reportServerError } from "@/lib/errors";
import type { ActionState } from "@/types/actions";

export async function loginAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const input = loginSchema.safeParse({
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!input.success)
    return {
      errors: input.error.flatten().fieldErrors,
      message: "Revisá los campos indicados",
    };
  if (!getSupabaseConfiguration())
    return { message: "El acceso está pendiente de configuración" };
  try {
    const supabase = await createSupabaseServerClient(true);
    const { error } = await supabase.auth.signInWithPassword(input.data);
    if (error)
      return {
        message:
          error.code === "over_request_rate_limit"
            ? "Demasiados intentos. Esperá unos minutos y volvé a intentar."
            : "No pudimos iniciar sesión. Revisá tus datos y confirmá tu email.",
      };
  } catch (error) {
    reportServerError("auth.login_unavailable", error);
    return {
      message:
        "El acceso no está disponible en este momento. Intentá nuevamente.",
    };
  }
  revalidatePath("/panel", "layout");
  redirect("/panel");
}

export async function registerAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const input = registrationSchema.safeParse({
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!input.success)
    return {
      errors: input.error.flatten().fieldErrors,
      message: "Revisá los campos indicados",
    };
  const configuration = getSupabaseConfiguration();
  if (!configuration)
    return { message: "El registro está pendiente de configuración" };
  let hasSession = false;
  try {
    const supabase = await createSupabaseServerClient(true);
    const { data, error } = await supabase.auth.signUp({
      ...input.data,
      options: {
        emailRedirectTo: new URL(
          "/auth/confirm",
          configuration.appUrl,
        ).toString(),
      },
    });
    if (error) {
      if (
        ["over_request_rate_limit", "over_email_send_rate_limit"].includes(
          error.code ?? "",
        )
      )
        return {
          message:
            "Demasiados intentos. Esperá unos minutos y volvé a intentar.",
        };
      if (error.code === "weak_password")
        return {
          errors: { password: ["Elegí una contraseña más fuerte"] },
          message: "Revisá la contraseña",
        };
      // No revelar si existe una cuenta asociada a un email.
      if (error.code !== "user_already_exists") {
        reportServerError("auth.signup_failed", error);
        return {
          message:
            "No pudimos procesar el registro. Intentá nuevamente más tarde.",
        };
      }
    }
    hasSession = Boolean(data.session);
  } catch (error) {
    reportServerError("auth.signup_unavailable", error);
    return {
      message:
        "El registro no está disponible en este momento. Intentá nuevamente.",
    };
  }
  if (hasSession) redirect("/panel");
  return {
    success: true,
    message:
      "Si el correo puede registrarse, recibirás un enlace para confirmar tu cuenta. Si ya tenés una cuenta, podés iniciar sesión.",
  };
}

export async function logoutAction(): Promise<ActionState> {
  await requireUser();
  try {
    const supabase = await createSupabaseServerClient(true);
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error)
      return { message: "No pudimos cerrar la sesión. Intentá nuevamente." };
  } catch (error) {
    reportServerError("auth.logout_failed", error);
    return { message: "No pudimos cerrar la sesión. Intentá nuevamente." };
  }
  revalidatePath("/panel", "layout");
  redirect("/ingresar?sesion=cerrada");
}
