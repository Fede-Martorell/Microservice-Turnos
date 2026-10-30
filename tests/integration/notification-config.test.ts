import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { notificationConfig } from "@/features/notifications/config";
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://db.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test_key");
  vi.stubEnv("NOTIFICATION_WORKER_SECRET", "a".repeat(64));
  vi.stubEnv("CRON_SECRET", "b".repeat(64));
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("NOTIFICATION_FROM_EMAIL", "Reservas <onboarding@resend.dev>");
  vi.stubEnv("NOTIFICATION_TEST_RECIPIENT", "owner@example.test");
  vi.stubEnv("NOTIFICATION_MODE", "disabled");
});
afterEach(() => vi.unstubAllEnvs());
describe("configuración de notificaciones con fallo cerrado", () => {
  it("no envía por defecto y permite preparar consultas sin proveedor", () => {
    expect(notificationConfig()?.canSend).toBe(false);
    vi.stubEnv("RESEND_API_KEY", "");
    expect(notificationConfig()).not.toBeNull();
  });
  it("test requiere un destinatario explícito válido y credenciales; no usa modo live por error", () => {
    vi.stubEnv("NOTIFICATION_MODE", "test");
    expect(notificationConfig()?.canSend).toBe(true);
    expect(notificationConfig()?.recipient).toBe("owner@example.test");
    vi.stubEnv("NOTIFICATION_TEST_RECIPIENT", "");
    expect(notificationConfig()?.canSend).toBe(false);
    vi.stubEnv("NOTIFICATION_MODE", "typo");
    expect(notificationConfig()?.mode).toBe("disabled");
  });
  it("live requiere origen HTTPS no local y un remitente propio", () => {
    vi.stubEnv("NOTIFICATION_MODE", "live");
    expect(notificationConfig()?.canSend).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://reservas.example");
    expect(notificationConfig()?.canSend).toBe(false);
    vi.stubEnv("NOTIFICATION_FROM_EMAIL", "Reservas <avisos@reservas.example>");
    expect(notificationConfig()?.canSend).toBe(true);
    expect(notificationConfig()?.recipient).toBeNull();
  });
  it("sin la credencial del worker no habilita ni consulta ni envío", () => {
    vi.stubEnv("NOTIFICATION_WORKER_SECRET", "");
    expect(notificationConfig()).toBeNull();
  });
});
