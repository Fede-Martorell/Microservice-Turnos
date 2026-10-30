import { beforeEach, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  rpc: vi.fn(),
  create: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.user }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.create,
}));
vi.mock("@/features/organizations/queries", () => ({
  requireOrganization: vi.fn(),
}));
vi.mock("@/lib/errors", () => ({ reportServerError: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("not_found");
  },
}));
import {
  requirePlatformAdmin,
  isPlatformAdmin,
} from "@/features/subscriptions/queries";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ user_metadata: { role: "admin" } });
  mocks.create.mockResolvedValue({ rpc: mocks.rpc });
});
it("ignora metadatos de rol y falla cerrado ante denegación o error SQL", async () => {
  for (const result of [
    { data: false, error: null },
    { data: null, error: { code: "42501" } },
    { data: "true", error: null },
  ]) {
    mocks.rpc.mockResolvedValue(result);
    await expect(requirePlatformAdmin()).rejects.toThrow("not_found");
  }
});
it("solo acepta confirmación explícita de la función protegida tras verificar usuario", async () => {
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  expect(await isPlatformAdmin()).toBe(true);
  expect(mocks.user).toHaveBeenCalled();
  expect(mocks.rpc).toHaveBeenCalledWith("get_platform_admin_context", {});
  mocks.user.mockRejectedValueOnce(new Error("ingresar"));
  mocks.create.mockClear();
  await expect(requirePlatformAdmin()).rejects.toThrow("ingresar");
  expect(mocks.create).not.toHaveBeenCalled();
});
