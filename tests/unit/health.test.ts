import { afterEach, it, expect, vi } from "vitest";
import { GET, HEAD } from "@/app/api/health/route";
afterEach(() => vi.unstubAllEnvs());
it("expone solo estado del proceso en local y nunca cachea", async () => {
  vi.stubEnv("PILOT_DEPLOYMENT", "0");
  const response = GET();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("x-robots-tag")).toContain("noindex");
  expect(await response.json()).toEqual({
    status: "ok",
    scope: "process",
    dependencies: "not_checked",
  });
  expect(await HEAD().text()).toBe("");
});
it("devuelve 503 con configuración inválida del piloto sin exponer valores", async () => {
  vi.stubEnv("PILOT_DEPLOYMENT", "1");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "invalid-secret-value");
  const response = GET();
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("invalid-secret-value");
  expect(HEAD().status).toBe(503);
});
