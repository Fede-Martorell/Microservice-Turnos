import "server-only";
import {
  getEnvironment,
  getSupabaseConfiguration,
} from "@/lib/config/environment.server";
export function publicBookingConfig() {
  const environment = getEnvironment();
  const supabase = getSupabaseConfiguration();
  const secret = Reflect.get(process.env, "PUBLIC_BOOKING_GATEWAY_SECRET") as
    string | undefined;
  if (!environment || !supabase || !secret || !/^[0-9a-f]{64}$/.test(secret))
    return null;
  const origin = new URL(environment.NEXT_PUBLIC_APP_URL);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
  const siteKey = Reflect.get(
    process.env,
    "PUBLIC_BOOKING_TURNSTILE_SITE_KEY",
  ) as string | undefined;
  const captchaSecret = Reflect.get(
    process.env,
    "PUBLIC_BOOKING_TURNSTILE_SECRET_KEY",
  ) as string | undefined;
  return {
    secret,
    supabase,
    origin: origin.origin,
    secure: origin.protocol === "https:",
    local,
    siteKey: siteKey ?? null,
    captchaSecret: captchaSecret ?? null,
    canCreate: local || Boolean(siteKey && captchaSecret),
  };
}
