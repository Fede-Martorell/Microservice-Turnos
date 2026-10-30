import { it, expect } from "vitest";
import { validatePilotEnvironment } from "@/lib/deployment/pilot-environment.mjs";
const env = {
  NEXT_PUBLIC_APP_URL: "https://reservas.example.test",
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
  PUBLIC_BOOKING_GATEWAY_SECRET: "a".repeat(64),
  PUBLIC_BOOKING_TURNSTILE_SITE_KEY: "fixture-site",
  PUBLIC_BOOKING_TURNSTILE_SECRET_KEY: "fixture-secret",
  NOTIFICATION_MODE: "disabled",
};
it("permite hosting con avisos desactivados y no exige credenciales de envío", () => {
  expect(validatePilotEnvironment(env).ok).toBe(true);
  expect(validatePilotEnvironment({}).ok).toBe(false);
});
it("rechaza orígenes inseguros, rutas y credenciales; localhost solo con opción explícita", () => {
  for (const value of [
    "http://example.test",
    "http://localhost:3000",
    "https://user:password@example.test",
    "https://example.test/subruta",
    "https://example.test?token=secreto",
    "https://example.test#hash",
    "javascript:alert(1)",
  ])
    expect(
      validatePilotEnvironment({ ...env, NEXT_PUBLIC_APP_URL: value }).ok,
    ).toBe(false);
  expect(
    validatePilotEnvironment(
      {
        ...env,
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        PUBLIC_BOOKING_TURNSTILE_SITE_KEY: "",
        PUBLIC_BOOKING_TURNSTILE_SECRET_KEY: "",
      },
      { local: true },
    ).ok,
  ).toBe(true);
});
it("rechaza claves privilegiadas y secretos con prefijo público sin devolver valores", () => {
  const jwt = (role: string) =>
    `header.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.signature`;
  expect(
    validatePilotEnvironment({
      ...env,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: jwt("anon"),
    }).ok,
  ).toBe(true);
  for (const key of [
    jwt("service_role"),
    "sb_secret_unsafe",
    "cualquier-texto",
  ])
    expect(
      validatePilotEnvironment({
        ...env,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
      }).ok,
    ).toBe(false);
  const result = validatePilotEnvironment({
    ...env,
    NEXT_PUBLIC_RESEND_API_KEY: "never-return-this-value",
  });
  expect(result.ok).toBe(false);
  expect(JSON.stringify(result)).not.toContain("never-return-this-value");
});
it("exige Turnstile y valida modo, worker y destinatario al habilitar avisos", () => {
  expect(
    validatePilotEnvironment({
      ...env,
      PUBLIC_BOOKING_TURNSTILE_SECRET_KEY: "",
    }).ok,
  ).toBe(false);
  expect(
    validatePilotEnvironment({ ...env, NOTIFICATION_MODE: "typo" }).ok,
  ).toBe(false);
  const test = {
    ...env,
    NOTIFICATION_MODE: "test",
    RESEND_API_KEY: "re_fixture",
    NOTIFICATION_FROM_EMAIL: "Reservas <onboarding@resend.dev>",
    NOTIFICATION_WORKER_SECRET: "b".repeat(64),
    CRON_SECRET: "c".repeat(32),
    NOTIFICATION_TEST_RECIPIENT: "tester@example.test",
  };
  expect(validatePilotEnvironment(test).ok).toBe(true);
  expect(
    validatePilotEnvironment({ ...test, NOTIFICATION_TEST_RECIPIENT: "" }).ok,
  ).toBe(false);
  expect(validatePilotEnvironment({ ...test, CRON_SECRET: "corto" }).ok).toBe(
    false,
  );
  expect(
    validatePilotEnvironment({ ...test, NOTIFICATION_MODE: "live" }).ok,
  ).toBe(false);
  expect(
    validatePilotEnvironment({
      ...test,
      NOTIFICATION_MODE: "live",
      NOTIFICATION_FROM_EMAIL: "Reservas <avisos@example.test>",
    }).ok,
  ).toBe(true);
});
