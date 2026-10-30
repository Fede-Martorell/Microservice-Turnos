import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireOrganization: vi.fn(),
  requireUser: vi.fn(),
  createClient: vi.fn(),
  rpc: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/features/organizations/queries", () => ({
  requireOrganization: mocks.requireOrganization,
}));
vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.requireUser }));
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
import { saveServiceAction } from "@/features/services/actions";
import { saveRuleAction } from "@/features/staff/availability-actions";
import { acceptInvitationAction } from "@/features/staff/invitation-actions";
const org = "00000000-0000-4000-8000-000000000001";
function form(values: Record<string, string>) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}
const service = {
  name: "Corte",
  description: "",
  category: "",
  duration_minutes: "30",
  preparation_minutes: "5",
  price: "0,29",
  currency: "ARS",
  image_url: "",
  is_active: "on",
  organization_id: "foreign",
  role: "owner",
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireOrganization.mockResolvedValue({ role: "owner" });
  mocks.requireUser.mockResolvedValue({ id: "verified" });
  mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
});
describe("acciones verificadas de catálogo", () => {
  it("comprueba autorización antes de procesar o persistir una solicitud directa", async () => {
    mocks.requireOrganization.mockRejectedValueOnce(new Error("not-found"));
    await expect(
      saveServiceAction(org, null, {}, form(service)),
    ).rejects.toThrow("not-found");
    mocks.requireOrganization.mockResolvedValueOnce({ role: "staff" });
    expect(
      (await saveServiceAction(org, null, {}, form(service))).message,
    ).toContain("Solo el propietario");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it("no acepta un horario inválido aunque se omita la validación del navegador", async () => {
    const state = await saveRuleAction(
      org,
      null,
      null,
      {},
      form({ weekday: "1", kind: "working", start: "18:00", end: "09:00" }),
    );
    expect(state.errors?.end).toBeDefined();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("conserva el contexto verificado y convierte el importe a unidades menores exactas", async () => {
    mocks.rpc.mockResolvedValue({ data: org, error: null });
    await expect(
      saveServiceAction(org, null, {}, form(service)),
    ).rejects.toThrow(`redirect:/panel/${org}/servicios/${org}`);
    expect(mocks.rpc).toHaveBeenCalledWith(
      "save_service",
      expect.objectContaining({
        p_organization_id: org,
        p_data: expect.objectContaining({ price_minor: 29, is_active: true }),
        p_staff_ids: [],
      }),
    );
    expect(mocks.rpc.mock.calls[0]?.[1].p_data).not.toHaveProperty("role");
    expect(mocks.revalidate).toHaveBeenCalled();
  });
  it("explica conflictos SQL sin exponer detalles internos", async () => {
    mocks.rpc.mockResolvedValue({
      error: { code: "23P01", message: "private SQL" },
      data: null,
    });
    const state = await saveRuleAction(
      org,
      null,
      null,
      {},
      form({ weekday: "1", kind: "working", start: "09:00", end: "18:00" }),
    );
    expect(state.message).toContain("superpone");
    expect(JSON.stringify(state)).not.toContain("private SQL");
  });
  it("exige sesión y token válido para aceptar una invitación", async () => {
    mocks.requireUser.mockRejectedValueOnce(new Error("sin sesión"));
    await expect(
      acceptInvitationAction({}, form({ token: "a".repeat(64) })),
    ).rejects.toThrow("sin sesión");
    expect(
      (await acceptInvitationAction({}, form({ token: "bad" }))).message,
    ).toContain("no es válida");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("revalida la invitación en la transacción y mantiene la redirección interna", async () => {
    mocks.rpc.mockResolvedValueOnce({ error: { code: "42501" }, data: null });
    expect(
      (await acceptInvitationAction({}, form({ token: "a".repeat(64) })))
        .message,
    ).toContain("venció");
    mocks.rpc.mockResolvedValueOnce({ error: null, data: org });
    await expect(
      acceptInvitationAction(
        {},
        form({ token: "a".repeat(64), next: "https://example.com" }),
      ),
    ).rejects.toThrow(`redirect:/panel/${org}`);
  });
});
