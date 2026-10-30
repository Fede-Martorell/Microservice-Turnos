import { beforeEach, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  organization: vi.fn(),
  create: vi.fn(),
  rpc: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/features/subscriptions/queries", () => ({
  requirePlatformAdmin: mocks.admin,
}));
vi.mock("@/features/organizations/queries", () => ({
  requireOrganization: mocks.organization,
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.create,
}));
vi.mock("@/lib/errors", () => ({ reportServerError: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import {
  savePlanAction,
  saveSubscriptionAction,
  saveModuleAction,
  saveFeedbackAction,
  saveOrganizationStatusAction,
  saveTrialPolicyAction,
} from "@/features/subscriptions/actions";
const org = crypto.randomUUID();
function form(values: Record<string, string>) {
  const result = new FormData();
  for (const [k, v] of Object.entries(values)) result.set(k, v);
  return result;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.create.mockResolvedValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ error: null });
  mocks.organization.mockResolvedValue({ role: "owner" });
});
it("revalida administración antes de todas las mutaciones internas", async () => {
  mocks.admin.mockRejectedValue(new Error("not_found"));
  for (const call of [
    () => savePlanAction(null, null, {}, form({})),
    () => saveSubscriptionAction(org, 1, {}, form({})),
    () => saveModuleAction(org, null, null, {}, form({})),
    () => saveOrganizationStatusAction(org, {}, form({})),
    () => saveTrialPolicyAction({}, form({})),
  ])
    await expect(call()).rejects.toThrow("not_found");
  expect(mocks.create).not.toHaveBeenCalled();
});
it("el precio se convierte según moneda y no acepta datos ajenos al contrato", async () => {
  const f = form({
    code: "nuevo",
    name: "Nuevo plan",
    description: "",
    price: "25,50",
    currency: "USD",
    max_professionals: "3",
    is_active: "true",
    organization_id: crypto.randomUUID(),
    role: "admin",
  });
  f.append("modules", "bookings");
  expect((await savePlanAction(null, null, {}, f)).success).toBe(true);
  expect(mocks.rpc).toHaveBeenCalledWith("admin_save_plan", {
    p_code: "nuevo",
    p_version: null,
    p_data: {
      name: "Nuevo plan",
      description: "",
      price_minor: 2550,
      currency: "USD",
      max_professionals: 3,
      is_active: true,
    },
    p_modules: ["bookings"],
  });
});
it("rechaza importes, períodos y versiones inválidos antes de persistir", async () => {
  expect(
    (
      await saveSubscriptionAction(
        org,
        1,
        {},
        form({
          plan: "business",
          status: "pilot",
          starts_on: "2026-10-24",
          ends_on: "2026-10-22",
          reason: "Piloto",
          notes: "",
        }),
      )
    ).errors?.ends_on,
  ).toBeDefined();
  expect(
    (await saveSubscriptionAction(org, 0, {}, form({}))).message,
  ).toContain("Actualizá");
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("usa el tenant y la versión ligados por el servidor y comunica conflictos", async () => {
  mocks.rpc.mockResolvedValue({ error: { code: "40001" } });
  const result = await saveSubscriptionAction(
    org,
    3,
    {},
    form({
      organization_id: crypto.randomUUID(),
      version: "99",
      plan: "business",
      status: "pilot",
      starts_on: "2026-10-22",
      ends_on: "2026-11-20",
      reason: "Extender piloto",
      notes: "Notas",
    }),
  );
  expect(mocks.rpc).toHaveBeenCalledWith(
    "admin_save_subscription",
    expect.objectContaining({ p_organization_id: org, p_version: 3 }),
  );
  expect(result.message).toContain("Actualizá");
  expect(mocks.revalidate).not.toHaveBeenCalled();
});
it("bloquea feedback de staff y valida escalas antes de escribir", async () => {
  mocks.organization.mockResolvedValueOnce({ role: "staff" });
  expect((await saveFeedbackAction(org, {}, form({}))).message).toContain(
    "propietario",
  );
  expect(
    (
      await saveFeedbackAction(
        org,
        {},
        form({
          problems: "",
          difficulty: "6",
          requests: "",
          perceived_value: "0",
          willing_to_pay: "yes",
          suggestions: "",
        }),
      )
    ).errors?.difficulty,
  ).toBeDefined();
  expect(mocks.create).not.toHaveBeenCalled();
});
it("no filtra mensajes internos de la base y conserva errores de límites útiles", async () => {
  const f = form({ plan: "business", days: "14" });
  mocks.rpc.mockResolvedValueOnce({
    error: { code: "XX000", message: "secreto" },
  });
  expect((await saveTrialPolicyAction({}, f)).message).not.toContain("secreto");
  mocks.rpc.mockResolvedValueOnce({ error: { code: "P1002" } });
  expect((await saveTrialPolicyAction({}, f)).message).toContain("límite");
});
