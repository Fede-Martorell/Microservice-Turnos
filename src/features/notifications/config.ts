import "server-only";
import { z } from "zod";
import {
  getSupabaseConfiguration,
  getEnvironment,
} from "@/lib/config/environment.server";
const env = (name: string) =>
  Reflect.get(process.env, name) as string | undefined;
export function notificationConfig() {
  const supabase = getSupabaseConfiguration();
  const workerSecret = env("NOTIFICATION_WORKER_SECRET");
  const cronSecret = env("CRON_SECRET");
  if (
    !supabase ||
    !workerSecret ||
    !/^[0-9a-f]{64}$/.test(workerSecret) ||
    !cronSecret ||
    cronSecret.length < 32
  )
    return null;
  const mode = z
    .enum(["disabled", "test", "live"])
    .catch("disabled")
    .parse(env("NOTIFICATION_MODE"));
  const from = env("NOTIFICATION_FROM_EMAIL") ?? "";
  const key = env("RESEND_API_KEY") ?? "";
  const target = z
    .email()
    .safeParse(env("NOTIFICATION_TEST_RECIPIENT")?.trim().toLowerCase());
  const origin = getEnvironment()?.NEXT_PUBLIC_APP_URL ?? "";
  const url = new URL(origin);
  const sender =
    /^(?:[^<>\r\n]+ <)?[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+>?$/.test(from) &&
    from.length <= 254;
  const liveReady =
    url.protocol === "https:" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
    !from.includes("@resend.dev");
  return {
    supabase,
    workerSecret,
    cronSecret,
    mode,
    from,
    key,
    recipient: mode === "test" && target.success ? target.data : null,
    origin: url.origin,
    canSend:
      !!key &&
      sender &&
      ((mode === "test" && target.success) || (mode === "live" && liveReady)),
  };
}
