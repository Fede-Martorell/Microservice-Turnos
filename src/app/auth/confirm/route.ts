import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfiguration } from "@/lib/config/environment.server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { reportServerError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  const configuration = getSupabaseConfiguration();
  const response = (path: string) => {
    const result = NextResponse.redirect(
      new URL(path, configuration?.appUrl ?? request.nextUrl.origin),
    );
    result.headers.set("Cache-Control", "private, no-store, max-age=0");
    result.headers.set("Referrer-Policy", "no-referrer");
    return result;
  };
  if (!configuration) return response("/ingresar?error=configuracion");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const code = request.nextUrl.searchParams.get("code");
  if (
    (!tokenHash && !code) ||
    (tokenHash && code) ||
    (tokenHash?.length ?? 0) > 2048 ||
    (code?.length ?? 0) > 2048
  )
    return response("/ingresar?error=confirmacion");
  try {
    const supabase = await createSupabaseServerClient(true);
    const { error } = tokenHash
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" })
      : await supabase.auth.exchangeCodeForSession(code!);
    if (error) return response("/ingresar?error=confirmacion");
  } catch (error) {
    reportServerError("auth.confirmation_failed", error);
    return response("/ingresar?error=confirmacion");
  }
  return response("/panel");
}
