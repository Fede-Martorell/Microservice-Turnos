import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  requireOrganization: vi.fn(),
  create: vi.fn(),
  rpc: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/features/organizations/queries", () => ({
  requireOrganization: mocks.requireOrganization,
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.create,
}));
vi.mock("@/lib/errors", () => ({ reportServerError: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));
import {
  saveCustomerAction,
  saveCustomerPreferencesAction,
} from "@/features/customers/actions";
import { saveNotificationSettingsAction } from "@/features/notifications/actions";
const org = crypto.randomUUID(),
  id = crypto.randomUUID();
const form = (values: Record<string, string>) => {
  const f = new FormData();
  Object.entries(values).forEach(([k, v]) => f.set(k, v));
  return f;
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireOrganization.mockResolvedValue({ role: "owner" });
  mocks.create.mockResolvedValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ data: id, error: null });
});
describe("acciones de clientes y ajustes de avisos", () => {
  it("revalida autorización y bloquea staff antes de crear cliente o cambiar consentimientos", async () => {
    mocks.requireOrganization.mockResolvedValue({ role: "staff" });
    expect(
      (await saveCustomerAction(org, null, null, {}, form({}))).message,
    ).toContain("propietario");
    expect(
      (await saveCustomerPreferencesAction(org, id, 1, {}, form({}))).message,
    ).toContain("propietario");
    expect(
      (await saveNotificationSettingsAction(org, {}, form({}))).message,
    ).toContain("propietario");
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("solo persiste campos permitidos, normaliza email y redirige a la ficha", async () => {
    await expect(
      saveCustomerAction(
        org,
        null,
        null,
        {},
        form({
          name: "Ana",
          email: " ANA@EXAMPLE.TEST ",
          phone: "",
          is_active: "true",
          organization_id: "ajeno",
          marketing_consent: "true",
        }),
      ),
    ).rejects.toThrow(`redirect:/panel/${org}/clientes/${id}`);
    expect(mocks.rpc).toHaveBeenCalledWith("save_customer", {
      p_organization_id: org,
      p_id: null,
      p_version: null,
      p_data: {
        name: "Ana",
        email: "ana@example.test",
        phone: "",
        is_active: true,
      },
    });
  });
  it("requiere evidencia antes de conceder marketing y valida versión", async () => {
    const result = await saveCustomerPreferencesAction(
      org,
      id,
      1,
      {},
      form({
        transactional_email: "true",
        marketing_consent: "true",
        consent_evidence: "",
      }),
    );
    expect(result.errors?.consent_evidence).toBeDefined();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(
      (
        await saveCustomerPreferencesAction(
          org,
          id,
          0,
          {},
          form({
            transactional_email: "false",
            marketing_consent: "false",
            consent_evidence: "",
          }),
        )
      ).message,
    ).toContain("Actualizá");
  });
  it("traduce duplicados y conflictos de versión sin exponer detalles privados", async () => {
    const f = form({
      name: "Ana",
      email: "ana@example.test",
      phone: "",
      is_active: "true",
    });
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "23505", message: "Private SQL" },
    });
    expect((await saveCustomerAction(org, id, 1, {}, f)).message).toContain(
      "Ya existe un cliente",
    );
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "40001", message: "secret" },
    });
    expect((await saveCustomerAction(org, id, 1, {}, f)).message).toContain(
      "La ficha cambió",
    );
  });
  it("guarda preferencias explícitas y no permite tomar el tenant desde el formulario", async () => {
    await saveCustomerPreferencesAction(
      org,
      id,
      4,
      {},
      form({
        transactional_email: "false",
        marketing_consent: "false",
        consent_evidence: "El cliente pidió no recibir avisos",
        organization_id: "ajeno",
      }),
    );
    expect(mocks.rpc).toHaveBeenCalledWith(
      "save_customer_preferences",
      expect.objectContaining({
        p_organization_id: org,
        p_version: 4,
        p_transactional: false,
        p_marketing: false,
      }),
    );
  });
  it("ajustes de recordatorios tienen rango y no ejecutan el procesador", async () => {
    expect(
      (
        await saveNotificationSettingsAction(
          org,
          {},
          form({
            enabled: "true",
            reminders_enabled: "true",
            reminder_minutes: "1",
          }),
        )
      ).errors?.reminder_minutes,
    ).toBeDefined();
    await saveNotificationSettingsAction(
      org,
      {},
      form({
        enabled: "true",
        reminders_enabled: "true",
        reminder_minutes: "1440",
      }),
    );
    expect(mocks.rpc).toHaveBeenCalledWith("save_notification_settings", {
      p_organization_id: org,
      p_enabled: true,
      p_reminders: true,
      p_minutes: 1440,
    });
  });
});
