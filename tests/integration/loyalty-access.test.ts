import { NextRequest } from "next/server";
import { beforeEach, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({ gateway: vi.fn(), rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/public-booking/gateway", () => ({
  publicGateway: mocks.gateway,
}));
vi.mock("@/lib/errors", () => ({ reportServerError: vi.fn() }));
import { POST } from "@/app/api/loyalty/access/route";
const token = "a".repeat(64);
const card = {
  organization_name: "Negocio",
  timezone: "UTC",
  program_name: "Club",
  mode: "points",
  balance: 5,
  expiry: { next_expiry: null, expired_balance: 0 },
  operational: true,
  conditions: "Condiciones",
  reset_mode: "subtract",
  expire_days: null,
  expires_at: "2027-01-01T00:00:00Z",
  rewards: [],
  history: [],
};
function request(
  body = JSON.stringify({ token }),
  origin = "https://app.example",
) {
  return new NextRequest("https://app.example/api/loyalty/access", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body,
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.gateway.mockResolvedValue({
    config: { origin: "https://app.example", secure: true, local: false },
    visitor: "b".repeat(64),
    client: { rpc: mocks.rpc },
  });
  mocks.rpc.mockResolvedValue({ data: { ok: true, card }, error: null });
});
it("intercambia por cookie HttpOnly/Secure/Strict limitada a la tarjeta, sin devolver saldo ni token", async () => {
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
  expect(response.headers.get("cache-control")).toContain("no-store");
  for (const flag of ["HttpOnly", "Secure", "SameSite=strict", "Path=/tarjeta"])
    expect(response.headers.get("set-cookie")).toContain(flag);
});
it("rechaza origen, cuerpo grande y token inválido sin consultar la tarjeta", async () => {
  expect((await POST(request(undefined, "https://ajeno.example"))).status).toBe(
    403,
  );
  expect((await POST(request("x".repeat(1025)))).status).toBe(413);
  expect((await POST(request(JSON.stringify({ token: "bad" })))).status).toBe(
    400,
  );
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("mantiene indistinguibles tokens inexistentes y revocados y controla cuotas", async () => {
  mocks.rpc.mockResolvedValueOnce({
    data: { ok: false, code: "not_found" },
    error: null,
  });
  expect((await POST(request())).status).toBe(404);
  mocks.rpc.mockResolvedValueOnce({
    data: { ok: false, code: "rate_limited" },
    error: null,
  });
  expect((await POST(request())).status).toBe(429);
});
it("falla cerrado sin HTTPS fuera de localhost y no filtra errores de transporte", async () => {
  mocks.gateway.mockResolvedValueOnce({
    config: { local: false, secure: false },
  });
  expect((await POST(request())).status).toBe(503);
  mocks.rpc.mockRejectedValueOnce(new Error(`privado ${token}`));
  const response = await POST(request());
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain(token);
});
