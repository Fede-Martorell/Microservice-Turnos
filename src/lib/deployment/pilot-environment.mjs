// Función pura compartida por el arranque y el healthcheck. Nunca devuelve valores.
const loopback = (hostname) =>
  ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
function origin(value, local) {
  try {
    const url = new URL(value);
    return (
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname === "/" &&
      ((url.protocol === "https:" && !loopback(url.hostname)) ||
        (local && url.protocol === "http:" && loopback(url.hostname)))
    );
  } catch {
    return false;
  }
}
function publicKey(value = "") {
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(value)) return true;
  try {
    const parts = value.split(".");
    return (
      parts.length === 3 &&
      JSON.parse(Buffer.from(parts[1], "base64url").toString()).role === "anon"
    );
  } catch {
    return false;
  }
}
const email = (value = "") =>
  /^[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+$/.test(value) && value.length <= 254;
export function validatePilotEnvironment(env, { local = false } = {}) {
  const checks = [];
  const check = (id, ok) => checks.push({ id, ok: Boolean(ok) });
  check("app_origin", origin(env.NEXT_PUBLIC_APP_URL, local));
  check("supabase_origin", origin(env.NEXT_PUBLIC_SUPABASE_URL, local));
  check(
    "supabase_public_key",
    publicKey(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
  );
  check(
    "public_gateway",
    /^[a-f0-9]{64}$/.test(env.PUBLIC_BOOKING_GATEWAY_SECRET ?? ""),
  );
  check(
    "private_environment",
    !Object.entries(env).some(
      ([key, value]) =>
        value &&
        key.startsWith("NEXT_PUBLIC_") &&
        /SECRET|PASSWORD|SERVICE_ROLE|RESEND|CRON|PRIVATE_KEY/i.test(key),
    ),
  );
  const localApp =
    local &&
    (() => {
      try {
        return loopback(new URL(env.NEXT_PUBLIC_APP_URL).hostname);
      } catch {
        return false;
      }
    })();
  check(
    "public_antibot",
    localApp ||
      Boolean(
        env.PUBLIC_BOOKING_TURNSTILE_SITE_KEY?.trim() &&
        env.PUBLIC_BOOKING_TURNSTILE_SECRET_KEY?.trim(),
      ),
  );
  const mode = env.NOTIFICATION_MODE ?? "disabled";
  check("notification_mode", ["disabled", "test", "live"].includes(mode));
  if (["test", "live"].includes(mode)) {
    check(
      "notification_worker",
      /^[a-f0-9]{64}$/.test(env.NOTIFICATION_WORKER_SECRET ?? "") &&
        (env.CRON_SECRET?.length ?? 0) >= 32,
    );
    check(
      "notification_provider",
      /^re_[A-Za-z0-9_-]+$/.test(env.RESEND_API_KEY ?? ""),
    );
    const from = env.NOTIFICATION_FROM_EMAIL ?? "";
    check(
      "notification_sender",
      /^(?:[^<>\r\n]+ <)?[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+>?$/.test(from) &&
        from.length <= 254 &&
        (mode !== "live" || !/@resend\.dev>?$/i.test(from)),
    );
    if (mode === "test")
      check("notification_recipient", email(env.NOTIFICATION_TEST_RECIPIENT));
    if (mode === "live")
      check("notification_https", origin(env.NEXT_PUBLIC_APP_URL, false));
  }
  return { ok: checks.every((item) => item.ok), checks };
}
