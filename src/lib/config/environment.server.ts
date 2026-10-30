import "server-only";
import { publicEnvironmentSchema } from "@/lib/validation/environment";

export function getEnvironment() {
  // Lectura en runtime: el build portable no fija la configuración del entorno de origen.
  const variables = Object.fromEntries(
    [
      "NEXT_PUBLIC_APP_URL",
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    ].map((name) => [name, Reflect.get(process.env, name)]),
  );
  const result = publicEnvironmentSchema.safeParse(variables);
  return result.success ? result.data : null;
}

export function getSupabaseConfiguration() {
  const env = getEnvironment();
  if (
    !env?.NEXT_PUBLIC_SUPABASE_URL ||
    !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
    return null;
  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    key: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    appUrl: env.NEXT_PUBLIC_APP_URL,
  };
}
