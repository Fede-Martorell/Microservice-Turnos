import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  config: vi.fn(),
  client: vi.fn(),
  rpc: vi.fn(),
  send: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/features/notifications/config", () => ({
  notificationConfig: mocks.config,
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.client }));
vi.mock("@/features/notifications/provider", () => ({
  sendNotification: mocks.send,
}));
import { runNotifications } from "@/features/notifications/worker";
import { managementToken, hashToken } from "@/lib/public-booking/visitor";
const secret = "a".repeat(64),
  visitor = "b".repeat(64),
  key = crypto.randomUUID();
const config = {
  supabase: { url: "https://db.example", key: "public-key" },
  workerSecret: "c".repeat(64),
  cronSecret: "d".repeat(64),
  mode: "test",
  from: "Reservas <onboarding@resend.dev>",
  key: "server-resend-key",
  recipient: "allowed@example.test",
  origin: "http://localhost:3000",
  canSend: true,
};
const token = managementToken("negocio", key, visitor, secret);
const claim = {
  id: crypto.randomUUID(),
  claim_token: crypto.randomUUID(),
  kind: "created",
  message: null,
  access: { request_key: key, visitor, token_hash: hashToken(token) },
  snapshot: {
    organization_name: "Negocio",
    slug: "negocio",
    customer_name: "Ana",
    customer_email: "allowed@example.test",
    service_name: "Consulta",
    staff_name: "Profesional",
    starts_at: "2027-01-04T12:00:00Z",
    ends_at: "2027-01-04T12:30:00Z",
    timezone: "America/Argentina/Buenos_Aires",
    status: "confirmed",
    price_minor: 150000,
    currency: "ARS",
    contact_email: "",
    contact_phone: "",
  },
};
const frozen = {
  from: config.from,
  to: config.recipient,
  subject: "Cuerpo original",
  text: "Original",
  html: "<p>Original</p>",
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("PUBLIC_BOOKING_GATEWAY_SECRET", secret);
  mocks.config.mockReturnValue(config);
  mocks.client.mockReturnValue({ rpc: mocks.rpc });
  mocks.send.mockResolvedValue({
    outcome: "sent",
    providerId: "provider_123",
    error: null,
  });
});
describe("procesador acotado, sin sesión del panel", () => {
  it("dry run consulta solo contadores, sin reclamar ni llamar a Resend", async () => {
    mocks.rpc.mockResolvedValue({ data: { due: 4 }, error: null });
    const result = await runNotifications();
    expect(result).toMatchObject({ dryRun: true, due: 4, processed: 0 });
    expect(mocks.rpc).toHaveBeenCalledWith("notification_queue_status", {
      p_recipient: config.recipient,
    });
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("modo desactivado falla antes de reclamar trabajos", async () => {
    mocks.config.mockReturnValue({
      ...config,
      canSend: false,
      mode: "disabled",
    });
    await expect(runNotifications(false)).rejects.toThrow(
      "notifications_disabled",
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("congela antes del envío, genera enlace verificable y finaliza por token de lease", async () => {
    mocks.rpc.mockImplementation(
      async (name: string, args: Record<string, unknown>) => ({
        data:
          name === "claim_notification_jobs"
            ? [claim]
            : name === "prepare_notification_delivery"
              ? args.p_message
              : true,
        error: null,
      }),
    );
    expect(await runNotifications(false, 1)).toMatchObject({
      processed: 1,
      sent: 1,
    });
    const prepared = mocks.rpc.mock.calls.find(
      (call) => call[0] === "prepare_notification_delivery",
    )?.[1].p_message;
    expect(prepared.text).toContain(`#token=${token}`);
    expect(mocks.send).toHaveBeenCalledWith(config.key, claim.id, prepared);
    expect(mocks.rpc).toHaveBeenLastCalledWith(
      "finish_notification_job",
      expect.objectContaining({
        p_id: claim.id,
        p_claim: claim.claim_token,
        p_outcome: "sent",
      }),
    );
  });
  it("reusa exactamente el cuerpo congelado, incluso con nueva configuración de remitente", async () => {
    mocks.rpc.mockImplementation(async (name: string) => ({
      data:
        name === "claim_notification_jobs"
          ? [{ ...claim, message: frozen }]
          : name === "prepare_notification_delivery"
            ? frozen
            : true,
      error: null,
    }));
    await runNotifications(false, 1);
    expect(mocks.send).toHaveBeenCalledWith(config.key, claim.id, frozen);
  });
  it("no redirige avisos ajenos al destinatario permitido ni envía tras omisión de BD", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: [
        {
          ...claim,
          snapshot: { ...claim.snapshot, customer_email: "other@example.test" },
        },
      ],
      error: null,
    });
    await expect(runNotifications(false, 1)).rejects.toThrow(
      "recipient_mismatch",
    );
    expect(mocks.send).not.toHaveBeenCalled();
    mocks.rpc
      .mockResolvedValueOnce({ data: [claim], error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    expect(await runNotifications(false, 1)).toMatchObject({
      skipped: 1,
      sent: 0,
    });
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("una falla al confirmar resultado queda recuperable sin fabricar estado sent", async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: [claim], error: null })
      .mockResolvedValueOnce({ data: frozen, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: "network" } });
    await expect(runNotifications(false, 1)).rejects.toThrow(
      "notification_finish_failed",
    );
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });
});
