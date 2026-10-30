import { beforeEach, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({
  org: vi.fn(),
  client: vi.fn(),
  rpc: vi.fn(),
  report: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/features/organizations/queries", () => ({
  requireOrganization: m.org,
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: m.client,
}));
vi.mock("@/lib/errors", () => ({ reportServerError: m.report }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("not-found");
  },
}));
import { loadBusinessDashboard } from "@/features/dashboard/queries";
const org = crypto.randomUUID(),
  period = { from: "2026-10-01", to: "2026-10-31" };
beforeEach(() => {
  vi.resetAllMocks();
  m.org.mockResolvedValue({ role: "owner" });
  m.client.mockResolvedValue({ rpc: m.rpc });
});
it("rechaza personal antes de consultar métricas", async () => {
  m.org.mockResolvedValue({ role: "staff" });
  await expect(loadBusinessDashboard(org, period)).rejects.toThrow("not-found");
  expect(m.client).not.toHaveBeenCalled();
});
it("rechaza rangos inválidos antes de llamar al cliente", async () => {
  await expect(
    loadBusinessDashboard(org, { from: "2026-01-01", to: "2026-12-31" }),
  ).rejects.toThrow();
  expect(m.client).not.toHaveBeenCalled();
});
it("envía el tenant validado y oculta errores del proveedor", async () => {
  m.rpc.mockResolvedValue({
    data: null,
    error: { code: "42501", message: "detalle privado" },
  });
  await expect(loadBusinessDashboard(org, period)).rejects.toThrow(
    "No pudimos cargar el resumen del negocio",
  );
  expect(m.org).toHaveBeenCalledWith(org);
  expect(m.rpc).toHaveBeenCalledWith("get_business_dashboard", {
    p_organization_id: org,
    p_from: period.from,
    p_to: period.to,
  });
});
it("no presenta como ceros un contrato vacío o inválido", async () => {
  m.rpc.mockResolvedValue({ data: { counts: { total: 0 } }, error: null });
  await expect(loadBusinessDashboard(org, period)).rejects.toThrow(
    "No pudimos cargar el resumen del negocio",
  );
  expect(m.report).toHaveBeenCalledWith("dashboard.read_failed", {
    code: "INVALID_CONTRACT",
  });
});
