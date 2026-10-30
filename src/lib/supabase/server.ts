import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfiguration } from "@/lib/config/environment.server";
import type { Database } from "@/types/database";

export async function createSupabaseServerClient(writable = false) {
  const configuration = getSupabaseConfiguration();
  if (!configuration) throw new Error("Supabase no está configurado");
  const cookieStore = await cookies();
  return createServerClient<Database>(configuration.url, configuration.key, {
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: new URL(configuration.appUrl).protocol === "https:",
      path: "/",
    },
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        // Proxy refresca antes del render. Solo Actions/Route Handlers escriben aquí.
        if (writable)
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
      },
    },
  });
}
