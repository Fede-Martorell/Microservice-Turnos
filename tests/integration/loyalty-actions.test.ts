import { beforeEach, it, expect, vi } from "vitest";
import { createHash } from "node:crypto";
const mocks = vi.hoisted(() => ({
  organization: vi.fn(),
  create: vi.fn(),
  rpc: vi.fn(),
  config: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/features/organizations/queries", () => ({
  requireOrganization: mocks.organization,
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.create,
}));
vi.mock("@/lib/public-booking/config", () => ({
  publicBookingConfig: mocks.config,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));
vi.mock("@/lib/errors", () => ({ reportServerError: vi.fn() }));
import {
  saveLoyaltyProgramAction,
  saveLoyaltyRewardAction,
  adjustLoyaltyAction,
  redeemLoyaltyAction,
  voidLoyaltyAction,
  issueLoyaltyCardAction,
  revokeLoyaltyCardAction,
  setLoyaltyActiveAction,
} from "@/features/loyalty/actions";
const org = crypto.randomUUID(),
  customer = crypto.randomUUID(),
  reward = crypto.randomUUID(),
  service = crypto.randomUUID();
function form(v: Record<string, string>) {
  const f = new FormData();
  for (const [k, value] of Object.entries(v)) f.set(k, value);
  return f;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.organization.mockResolvedValue({ role: "owner" });
  mocks.create.mockResolvedValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ error: null });
  mocks.config.mockReturnValue({
    local: true,
    secure: false,
    origin: "http://localhost:3000",
  });
});
it("revalida propietario en todas las acciones", async () => {
  mocks.organization.mockResolvedValue({ role: "staff" });
  for (const call of [
    () => saveLoyaltyProgramAction(org, null, "visits", {}, form({})),
    () => saveLoyaltyRewardAction(org, null, null, {}, form({})),
    () => adjustLoyaltyAction(org, customer, {}, form({})),
    () => redeemLoyaltyAction(org, customer, reward, 1, {}, form({})),
    () => voidLoyaltyAction(org, reward, {}, form({})),
    () => issueLoyaltyCardAction(org, customer, {}, form({})),
    () => revokeLoyaltyCardAction(org, customer, {}, form({})),
    () => setLoyaltyActiveAction(org, 1, false, {}, form({})),
  ])
    expect((await call()).message).toContain("propietario");
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("solo convierte campos de servicios permitidos y mantiene la versión ligada", async () => {
  const f = form({
    name: "Club",
    starts_on: "2026-10-22",
    ends_on: "2026-11-22",
    conditions: "Condiciones claras",
    expire_days: "90",
    reset_mode: "subtract",
    is_active: "true",
    [`earn_${service}`]: "3",
    organization_id: crypto.randomUUID(),
    version: "999",
  });
  await expect(
    saveLoyaltyProgramAction(org, 2, "points", {}, f),
  ).rejects.toThrow(`redirect:/panel/${org}/fidelizacion`);
  expect(mocks.rpc).toHaveBeenCalledWith("save_loyalty_program", {
    p_organization_id: org,
    p_version: 2,
    p_data: {
      name: "Club",
      mode: "points",
      starts_on: "2026-10-22",
      ends_on: "2026-11-22",
      conditions: "Condiciones claras",
      expire_days: 90,
      reset_mode: "subtract",
      is_active: true,
    },
    p_services: { [service]: 3 },
  });
});
it("rechaza ajuste cero, ausencia de motivo y solicitud inválida antes de persistir", async () => {
  expect(
    (
      await adjustLoyaltyAction(
        org,
        customer,
        {},
        form({ amount: "0", reason: "", reference: "", request_key: "bad" }),
      )
    ).errors?.amount,
  ).toBeDefined();
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("envía la misma solicitud de canje para que SQL la deduplique y no permite cambiar el cliente por formulario", async () => {
  const key = crypto.randomUUID();
  await redeemLoyaltyAction(
    org,
    customer,
    reward,
    4,
    {},
    form({
      request_key: key,
      customer_id: crypto.randomUUID(),
      reward_version: "100",
    }),
  );
  expect(mocks.rpc).toHaveBeenCalledWith("redeem_loyalty_reward", {
    p_organization_id: org,
    p_customer_id: customer,
    p_reward_id: reward,
    p_reward_version: 4,
    p_request_key: key,
  });
});
it("persiste solo hash y entrega el secreto en fragmento, sin enviar emails", async () => {
  const state = await issueLoyaltyCardAction(org, customer, {}, form({}));
  const url = new URL(state.link!);
  const token = new URLSearchParams(url.hash.slice(1)).get("token")!;
  expect(token).toMatch(/^[0-9a-f]{64}$/);
  expect(url.search).toBe("");
  expect(mocks.rpc).toHaveBeenCalledWith("issue_loyalty_card", {
    p_organization_id: org,
    p_customer_id: customer,
    p_token_hash: createHash("sha256").update(token).digest("hex"),
  });
  expect(state.message).toContain("No se envió");
  mocks.config.mockReturnValueOnce({ local: false, secure: false });
  expect(
    (await issueLoyaltyCardAction(org, customer, {}, form({}))).message,
  ).toContain("HTTPS");
});
it("comunica saldo insuficiente y oculta errores internos", async () => {
  mocks.rpc.mockResolvedValueOnce({ error: { code: "P2001" } });
  expect(
    (
      await redeemLoyaltyAction(
        org,
        customer,
        reward,
        1,
        {},
        form({ request_key: crypto.randomUUID() }),
      )
    ).message,
  ).toContain("saldo");
  mocks.rpc.mockResolvedValueOnce({
    error: { code: "XX000", message: "privado" },
  });
  expect(
    (await revokeLoyaltyCardAction(org, customer, {}, form({}))).message,
  ).not.toContain("privado");
});
