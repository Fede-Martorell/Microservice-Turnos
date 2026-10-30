import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { publicBookingConfig } from "./config";
import { verifyVisitor, visitorCookie, visitorDigest } from "./visitor";
export async function publicGateway() {
  const config = publicBookingConfig();
  if (!config) return null;
  const visitor = (await cookies()).get(visitorCookie)?.value;
  if (!verifyVisitor(visitor, config.secret)) return null;
  // Siempre anon. No se envían cookies/tokens de sesión del panel a las RPC públicas.
  const client = createClient<Database>(
    config.supabase.url,
    config.supabase.key,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: { "x-booking-gateway-secret": config.secret },
        fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
      },
    },
  );
  return { client, config, visitor: visitorDigest(visitor, config.secret) };
}
