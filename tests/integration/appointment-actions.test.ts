import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  requireOrganization: vi.fn(),
  createClient: vi.fn(),
  rpc: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/features/organizations/queries", () => ({
  requireOrganization: mocks.requireOrganization,
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createClient,
}));
vi.mock("@/lib/errors", () => ({ reportServerError: () => "test-reference" }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));
import {
  createAppointmentAction,
  changeStatusAction,
  rescheduleAction,
} from "@/features/appointments/actions";
const org = "00000000-0000-4000-8000-000000000001";
function form(values: Record<string, string> = {}) {
  const result = new FormData();
  Object.entries(values).forEach(([key, value]) => result.set(key, value));
  return result;
}
const input = {
  service_id: org,
  staff_id: org,
  starts_at: "2027-01-05T12:00:00Z",
  customer_name: "Cliente",
  customer_email: "persona@example.test",
  customer_phone: "",
  status: "confirmed",
  request_key: org,
  organization_id: "foreign",
  price_minor: "1",
  duration_minutes: "1",
  role: "owner",
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireOrganization.mockResolvedValue({ role: "staff" });
  mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
});
describe("acciones de reservas", () => {
  it("deniega acceso antes de persistir y valida datos aunque se invoque directamente", async () => {
    mocks.requireOrganization.mockRejectedValueOnce(new Error("not-found"));
    await expect(createAppointmentAction(org, {}, form(input))).rejects.toThrow(
      "not-found",
    );
    const result = await createAppointmentAction(
      org,
      {},
      form({ ...input, starts_at: "2027-01-05T09:00" }),
    );
    expect(result.errors?.starts_at).toBeDefined();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it("ignora precio, duración, rol y tenant enviados por el navegador", async () => {
    mocks.rpc.mockResolvedValue({ data: org, error: null });
    await expect(createAppointmentAction(org, {}, form(input))).rejects.toThrow(
      `redirect:/panel/${org}/reservas/${org}`,
    );
    const args = mocks.rpc.mock.calls[0]?.[1];
    expect(args.p_organization_id).toBe(org);
    expect(args).not.toHaveProperty("price_minor");
    expect(args).not.toHaveProperty("duration_minutes");
    expect(args).not.toHaveProperty("role");
    expect(mocks.revalidate).toHaveBeenCalled();
  });
  it("traduce conflicto concurrente y edición desactualizada sin filtrar detalles SQL", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "23P01", message: "private SQL" },
    });
    const conflict = await createAppointmentAction(org, {}, form(input));
    expect(conflict.message).toContain("dejó de estar disponible");
    expect(JSON.stringify(conflict)).not.toContain("private SQL");
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "40001" } });
    expect(
      (await changeStatusAction(org, org, 1, "canceled", {}, form())).message,
    ).toContain("cambió");
  });
  it("valida versión, transición e instante explícito antes de la RPC", async () => {
    expect(
      (await changeStatusAction(org, org, 0, "completed", {}, form())).errors
        ?.version,
    ).toBeDefined();
    expect(
      (await changeStatusAction(org, org, 1, "paid", {}, form())).errors
        ?.status,
    ).toBeDefined();
    expect(
      (await rescheduleAction(org, org, 1, {}, form({ starts_at: "mañana" })))
        .errors?.starts_at,
    ).toBeDefined();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
