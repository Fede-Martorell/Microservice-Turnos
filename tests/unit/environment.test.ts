import { describe, expect, it } from "vitest";
import { publicEnvironmentSchema } from "@/lib/validation/environment";

describe("configuración pública", () => {
  it("permite iniciar sin servicios externos", () => {
    expect(publicEnvironmentSchema.parse({}).NEXT_PUBLIC_APP_URL).toBe(
      "http://localhost:3000",
    );
    expect(
      publicEnvironmentSchema.safeParse({
        NEXT_PUBLIC_SUPABASE_URL: "",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      }).success,
    ).toBe(true);
  });
  it("rechaza una conexión parcialmente configurada", () => {
    expect(
      publicEnvironmentSchema.safeParse({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      }).success,
    ).toBe(false);
    expect(
      publicEnvironmentSchema.safeParse({
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-test-key",
      }).success,
    ).toBe(false);
  });
  it("rechaza protocolos no web", () => {
    expect(
      publicEnvironmentSchema.safeParse({
        NEXT_PUBLIC_APP_URL: "javascript:alert(1)",
      }).success,
    ).toBe(false);
  });
  it("elimina secretos y variables desconocidas de la salida", () => {
    const config = publicEnvironmentSchema.parse({
      RESEND_API_KEY: "test-secret",
      SUPABASE_SERVICE_ROLE_KEY: "test-secret",
    });
    expect(config).not.toHaveProperty("RESEND_API_KEY");
    expect(config).not.toHaveProperty("SUPABASE_SERVICE_ROLE_KEY");
  });
});
