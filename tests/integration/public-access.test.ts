import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ gateway: vi.fn(), rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/public-booking/gateway", () => ({
  publicGateway: mocks.gateway,
}));
vi.mock("@/lib/errors", () => ({ reportServerError: () => "test-ref" }));
import { POST } from "@/app/api/public-booking/access/route";
const token = "b".repeat(64);
beforeEach(() => {
  vi.resetAllMocks();
  mocks.gateway.mockResolvedValue({
    config: { origin: "https://reservas.example", secure: true },
    visitor: "a".repeat(64),
    client: { rpc: mocks.rpc },
  });
});
function request(body: string, origin = "https://reservas.example") {
  return new NextRequest("https://reservas.example/api/public-booking/access", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body,
  });
}
describe("intercambio de enlace por cookie privada", () => {
  it("guarda una cookie HttpOnly/Secure/Strict y devuelve solo el resultado del intercambio", async () => {
    const receipt = {
      organization_name: "Estudio",
      slug: "estudio",
      timezone: "UTC",
      contact_email: "",
      contact_phone: "",
      customer_name: "Persona privada",
      service_name: "Consulta",
      staff_name: "Profesional",
      starts_at: "2027-01-01T12:00:00Z",
      ends_at: "2027-01-01T12:30:00Z",
      occupied_until: "2027-01-01T12:40:00Z",
      duration_minutes: 30,
      preparation_minutes: 10,
      price_minor: 1000,
      currency: "ARS",
      status: "confirmed",
      version: 1,
      cancellation_policy: "Cambios con anticipación.",
      cancellation_notice_minutes: 1440,
      expires_at: "2027-01-08T12:40:00Z",
      can_manage: true,
    };
    mocks.rpc.mockResolvedValue({ data: { ok: true, receipt }, error: null });
    const response = await POST(request(JSON.stringify({ token })));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    const cookie = response.headers.get("Set-Cookie");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=strict");
    expect(cookie).toContain("Path=/reserva");
  });
  it("deniega origen distinto, cuerpo grande o token inválido antes de consultar la reserva", async () => {
    expect(
      (
        await POST(
          request(JSON.stringify({ token }), "https://attacker.example"),
        )
      ).status,
    ).toBe(403);
    expect((await POST(request("x".repeat(1025)))).status).toBe(413);
    expect((await POST(request(JSON.stringify({ token: "x" })))).status).toBe(
      400,
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("no devuelve información de una reserva cuando el token no existe o se agotó la cuota", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: { ok: false, code: "not_found" },
      error: null,
    });
    const invalid = await POST(request(JSON.stringify({ token })));
    expect(invalid.status).toBe(404);
    expect(await invalid.json()).toEqual({ ok: false });
    mocks.rpc.mockResolvedValueOnce({
      data: { ok: false, code: "rate_limited" },
      error: null,
    });
    expect((await POST(request(JSON.stringify({ token })))).status).toBe(429);
  });
  it("controla errores de red sin devolver detalles internos ni el token", async () => {
    mocks.rpc.mockRejectedValue(new Error("private details"));
    const response = await POST(request(JSON.stringify({ token })));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain(token);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
});
