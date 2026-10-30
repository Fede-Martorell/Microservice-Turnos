import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({ config: vi.fn(), run: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/features/notifications/config", () => ({
  notificationConfig: mocks.config,
}));
vi.mock("@/features/notifications/worker", () => ({
  runNotifications: mocks.run,
}));
vi.mock("@/lib/errors", () => ({ reportServerError: vi.fn() }));
import { POST } from "@/app/api/jobs/notifications/route";
const secret = "a".repeat(64);
const request = (body = "{}", auth = `Bearer ${secret}`) =>
  new Request("http://localhost:3000/api/jobs/notifications", {
    method: "POST",
    headers: { authorization: auth, "content-type": "application/json" },
    body,
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.config.mockReturnValue({ cronSecret: secret, canSend: true });
  mocks.run.mockResolvedValue({ dryRun: true, due: 0, processed: 0 });
});
describe("endpoint de trabajos", () => {
  it("requiere credencial explícita y rechaza valores Unicode sin fallar", async () => {
    expect((await POST(request("{}", "Bearer wrong"))).status).toBe(401);
    expect((await POST(request("{}", `Bearer ${"é".repeat(64)}`))).status).toBe(
      401,
    );
    expect(mocks.run).not.toHaveBeenCalled();
  });
  it("solo POST JSON acotado, sin parámetros arbitrarios ni lotes ilimitados", async () => {
    expect((await POST(request("x".repeat(513)))).status).toBe(413);
    expect((await POST(request("{broken"))).status).toBe(400);
    expect((await POST(request('{"limit":99}'))).status).toBe(400);
    expect(
      (await POST(request('{"recipient":"other@example.test"}'))).status,
    ).toBe(400);
  });
  it("la opción predeterminada no envía y responde sin datos privados ni caché", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.run).toHaveBeenCalledWith(true, 5);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({
      ok: true,
      dryRun: true,
      due: 0,
      processed: 0,
    });
  });
  it("con envíos desactivados rechaza la ejecución sin consumir trabajos", async () => {
    mocks.config.mockReturnValue({ cronSecret: secret, canSend: false });
    expect((await POST(request('{"dryRun":false}'))).status).toBe(503);
    expect(mocks.run).not.toHaveBeenCalled();
  });
});
