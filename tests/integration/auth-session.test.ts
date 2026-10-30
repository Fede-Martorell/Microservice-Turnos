import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  configured: vi.fn(),
  client: vi.fn(),
  getUser: vi.fn(),
  report: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/config/environment.server", () => ({
  getSupabaseConfiguration: mocks.configured,
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.client,
}));
vi.mock("@/lib/errors", () => ({ reportServerError: mocks.report }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));
import { getAuthenticatedUser, requireUser } from "@/lib/auth/session";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.configured.mockReturnValue({ url: "https://example.supabase.co" });
  mocks.client.mockResolvedValue({ auth: { getUser: mocks.getUser } });
});
describe("identidad validada por el proveedor", () => {
  it("sin configuración deniega acceso sin crear un cliente", async () => {
    mocks.configured.mockReturnValue(null);
    expect(await getAuthenticatedUser()).toBeNull();
    await expect(requireUser()).rejects.toThrow("redirect:/ingresar");
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("rechaza tokens inválidos aunque traigan datos de usuario", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "forged", email_confirmed_at: "2026-01-01" } },
      error: { code: "bad_jwt", status: 400 },
    });
    expect(await getAuthenticatedUser()).toBeNull();
  });
  it("requiere cuenta confirmada y no anónima", async () => {
    for (const user of [
      { id: "unconfirmed", email_confirmed_at: null },
      { id: "anonymous", email_confirmed_at: "2026-01-01", is_anonymous: true },
    ]) {
      mocks.getUser.mockResolvedValue({ data: { user }, error: null });
      expect(await getAuthenticatedUser()).toBeNull();
    }
  });
  it("acepta usuario confirmado verificado en servidor", async () => {
    const user = {
      id: "verified",
      email_confirmed_at: "2026-01-01",
      is_anonymous: false,
    };
    mocks.getUser.mockResolvedValue({ data: { user }, error: null });
    expect(await requireUser()).toEqual(user);
    expect(mocks.getUser).toHaveBeenCalled();
  });
  it("falla cerrado ante caída del proveedor sin filtrar el error original", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: { status: 503, message: "sensitive-provider-details" },
    });
    await expect(requireUser()).rejects.toThrow(
      "No pudimos verificar tu sesión",
    );
    expect(mocks.report).toHaveBeenCalled();
  });
});
