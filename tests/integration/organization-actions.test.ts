import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  requireOrganization: vi.fn(),
  createClient: vi.fn(),
  rpc: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  maybeSingle: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.requireUser }));
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
  createOrganizationAction,
  updateOrganizationAction,
} from "@/features/organizations/actions";

const id = "00000000-0000-4000-8000-000000000001";
function form(overrides: Record<string, string> = {}) {
  const result = new FormData();
  Object.entries({
    name: "Mi negocio",
    slug: "mi-negocio",
    description: "",
    timezone: "UTC",
    currency: "USD",
    ...overrides,
  }).forEach(([key, value]) => result.set(key, value));
  return result;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireUser.mockResolvedValue({ id: "verified-user" });
  mocks.requireOrganization.mockResolvedValue({
    organization: { id },
    role: "owner",
  });
  mocks.createClient.mockResolvedValue({
    rpc: mocks.rpc,
    from: () => ({ update: mocks.update }),
  });
  mocks.update.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue({ maybeSingle: mocks.maybeSingle });
});
describe("Server Actions de organizaciones", () => {
  it("rechaza creación sin identidad antes de validar o persistir", async () => {
    mocks.requireUser.mockRejectedValue(new Error("sin sesión"));
    await expect(createOrganizationAction({}, form())).rejects.toThrow(
      "sin sesión",
    );
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it("valida entradas en servidor antes de la RPC", async () => {
    expect(
      (await createOrganizationAction({}, form({ timezone: "Mars/Base" })))
        .errors?.timezone,
    ).toBeDefined();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it("no admite rol ni organización aportados por el navegador al crear", async () => {
    mocks.rpc.mockResolvedValue({ data: id, error: null });
    await expect(
      createOrganizationAction(
        {},
        form({ role: "superadmin", organization_id: "foreign" }),
      ),
    ).rejects.toThrow(`redirect:/panel/${id}`);
    expect(mocks.rpc).toHaveBeenCalledWith("create_organization", {
      p_name: "Mi negocio",
      p_slug: "mi-negocio",
      p_description: "",
      p_timezone: "UTC",
      p_currency: "USD",
    });
  });
  it("explica slugs duplicados sin revelar errores de SQL", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "private SQL details" },
    });
    const state = await createOrganizationAction({}, form());
    expect(state.errors?.slug).toEqual(["Ese identificador ya está en uso"]);
    expect(JSON.stringify(state)).not.toContain("private SQL");
  });
  it("staff no puede escribir aunque invoque directamente la acción", async () => {
    mocks.requireOrganization.mockResolvedValue({
      organization: { id },
      role: "staff",
    });
    expect((await updateOrganizationAction(id, {}, form())).message).toContain(
      "Solo el propietario",
    );
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it("el acceso ajeno se deniega antes de escribir", async () => {
    mocks.requireOrganization.mockRejectedValue(new Error("not-found"));
    await expect(updateOrganizationAction(id, {}, form())).rejects.toThrow(
      "not-found",
    );
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it("actualiza solo campos permitidos del contexto verificado", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { id }, error: null });
    expect(
      (
        await updateOrganizationAction(
          id,
          {},
          form({
            organization_id: "foreign",
            created_by: "other",
            role: "owner",
            status: "active",
          }),
        )
      ).success,
    ).toBe(true);
    expect(mocks.eq).toHaveBeenCalledWith("id", id);
    expect(mocks.update).toHaveBeenCalledWith({
      name: "Mi negocio",
      description: "",
      timezone: "UTC",
      currency: "USD",
    });
  });
});
