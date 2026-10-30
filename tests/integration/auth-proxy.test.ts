import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CookieOptions } from "@supabase/ssr";

type WriteCookies = (
  cookies: { name: string; value: string; options: CookieOptions }[],
  headers: Record<string, string>,
) => void;
const mocks = vi.hoisted(() => ({
  configured: vi.fn(),
  claims: vi.fn(),
  setAll: undefined as WriteCookies | undefined,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/config/environment.server", () => ({
  getSupabaseConfiguration: mocks.configured,
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _key: string,
    options: { cookies: { setAll: WriteCookies } },
  ) => {
    mocks.setAll = options.cookies.setAll;
    return { auth: { getClaims: mocks.claims } };
  },
}));
import { proxy } from "@/proxy";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.setAll = undefined;
  mocks.configured.mockReturnValue({
    url: "https://example.supabase.co",
    key: "public-test-key",
    appUrl: "https://app.example.com",
  });
});
describe("proxy de sesión y caché", () => {
  it("protege también administración interna y evita caché de respuestas", async () => {
    mocks.claims.mockResolvedValue({ data: null, error: null });
    const response = await proxy(
      new NextRequest("https://app.example.com/admin/planes"),
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("sin configuración redirige panel y permite cargar registro sin caché", async () => {
    mocks.configured.mockReturnValue(null);
    const privateResponse = await proxy(
      new NextRequest("https://app.example.com/panel"),
    );
    expect(privateResponse.status).toBe(307);
    expect(privateResponse.headers.get("location")).toBe(
      "https://app.example.com/ingresar",
    );
    const authResponse = await proxy(
      new NextRequest("https://app.example.com/registro"),
    );
    expect(authResponse.status).toBe(200);
    expect(authResponse.headers.get("cache-control")).toContain("no-store");
    expect(mocks.claims).not.toHaveBeenCalled();
  });
  it("conserva múltiples escrituras de cookies y las propaga al render", async () => {
    mocks.claims.mockImplementation(async () => {
      mocks.setAll?.(
        [
          {
            name: "session-a",
            value: "fresh-a",
            options: {
              httpOnly: true,
              secure: true,
              path: "/",
              sameSite: "lax",
            },
          },
        ],
        { "Cache-Control": "public, max-age=3600" },
      );
      mocks.setAll?.(
        [
          {
            name: "session-b",
            value: "fresh-b",
            options: { httpOnly: true, path: "/" },
          },
        ],
        {},
      );
      return { data: { claims: { sub: "verified-user" } }, error: null };
    });
    const request = new NextRequest("https://app.example.com/panel");
    const response = await proxy(request);
    expect(response.status).toBe(200);
    expect(response.cookies.get("session-a")?.value).toBe("fresh-a");
    expect(response.cookies.get("session-b")?.value).toBe("fresh-b");
    expect(request.cookies.get("session-a")?.value).toBe("fresh-a");
    expect(response.headers.get("cache-control")).toBe(
      "private, no-store, max-age=0",
    );
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  });
  it("conserva el borrado de cookies cuando debe redirigir", async () => {
    mocks.claims.mockImplementation(async () => {
      mocks.setAll?.(
        [
          {
            name: "session",
            value: "",
            options: { path: "/", maxAge: 0, httpOnly: true },
          },
        ],
        {},
      );
      return { data: null, error: { code: "bad_jwt" } };
    });
    const response = await proxy(
      new NextRequest("https://app.example.com/panel/tenant"),
    );
    expect(response.status).toBe(307);
    expect(response.cookies.get("session")?.maxAge).toBe(0);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("fallas de renovación deniegan acceso en vez de continuar al panel", async () => {
    mocks.claims.mockRejectedValue(new Error("network failure"));
    expect(
      (await proxy(new NextRequest("https://app.example.com/panel"))).status,
    ).toBe(307);
  });
});
