import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mocks.send };
  },
}));
import { sendNotification } from "@/features/notifications/provider";
const message = {
  from: "Reservas <onboarding@resend.dev>",
  to: "cliente@example.test",
  subject: "Reserva",
  text: "Texto",
  html: "<p>Texto</p>",
};
beforeEach(() => vi.resetAllMocks());
describe("adaptador Resend", () => {
  it("usa clave de idempotencia estable y timeout y registra aceptación, no entrega", async () => {
    mocks.send.mockResolvedValue({ data: { id: "provider_123" }, error: null });
    expect(await sendNotification("test-secret", "job-123", message)).toEqual({
      outcome: "sent",
      providerId: "provider_123",
      error: null,
    });
    expect(mocks.send).toHaveBeenCalledWith(
      message,
      expect.objectContaining({
        idempotencyKey: "booking-notification/job-123",
        signal: expect.any(AbortSignal),
      }),
    );
  });
  it.each([429, 500, 503])(
    "reintenta error temporal %s sin filtrar mensaje",
    async (status) => {
      mocks.send.mockResolvedValue({
        data: null,
        error: {
          statusCode: status,
          name: "error",
          message: "Datos privados y clave",
        },
      });
      const result = await sendNotification("secret", "job", message);
      expect(result.outcome).toBe("retry");
      expect(JSON.stringify(result)).not.toContain("Datos privados");
    },
  );
  it("no reintenta errores de configuración y sí una falla ambigua de red", async () => {
    mocks.send.mockResolvedValueOnce({
      data: null,
      error: { statusCode: 403, name: "validation_error" },
    });
    expect((await sendNotification("secret", "job", message)).outcome).toBe(
      "failed",
    );
    mocks.send.mockRejectedValueOnce(new Error("secret"));
    expect(await sendNotification("secret", "job", message)).toEqual({
      outcome: "retry",
      providerId: null,
      error: "network_error",
    });
  });
  it("409 concurrente se reintenta; un cuerpo distinto para una clave usada falla", async () => {
    mocks.send.mockResolvedValueOnce({
      data: null,
      error: { statusCode: 409, name: "concurrent_idempotent_requests" },
    });
    expect((await sendNotification("secret", "job", message)).outcome).toBe(
      "retry",
    );
    mocks.send.mockResolvedValueOnce({
      data: null,
      error: { statusCode: 409, name: "invalid_idempotent_request" },
    });
    expect((await sendNotification("secret", "job", message)).outcome).toBe(
      "failed",
    );
  });
});
