import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSupabaseConfiguration } from "@/lib/config/environment.server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { reportServerError } from "@/lib/errors";

export const getAuthenticatedUser = cache(async () => {
  if (!getSupabaseConfiguration()) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  const invalidSession =
    error &&
    (error.name === "AuthSessionMissingError" ||
      error.status === 401 ||
      error.status === 403 ||
      [
        "bad_jwt",
        "refresh_token_not_found",
        "refresh_token_already_used",
        "session_not_found",
        "user_not_found",
      ].includes(error.code ?? ""));
  if (error && !invalidSession) {
    reportServerError("auth.verify_failed", error);
    throw new Error("No pudimos verificar tu sesión. Intentá nuevamente.");
  }
  if (error || !data.user?.email_confirmed_at || data.user.is_anonymous)
    return null;
  return data.user;
});

export async function requireUser() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/ingresar");
  return user;
}
