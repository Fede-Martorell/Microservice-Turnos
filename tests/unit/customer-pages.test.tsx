import { render, screen } from "@testing-library/react";
import { beforeEach, describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  load: vi.fn(),
  notifications: vi.fn(),
  config: vi.fn(),
}));
vi.mock("@/components/layout/organization-screen", () => ({
  OrganizationScreen: ({ children }: { children: ReactNode }) => (
    <main>{children}</main>
  ),
}));
vi.mock("@/features/customers/queries", () => ({
  loadCustomers: mocks.list,
  loadCustomer: mocks.load,
}));
vi.mock("@/features/notifications/queries", () => ({
  loadNotifications: mocks.notifications,
}));
vi.mock("@/features/notifications/config", () => ({
  notificationConfig: mocks.config,
}));
vi.mock("@/features/customers/actions", () => ({
  saveCustomerAction: vi.fn(),
  saveCustomerPreferencesAction: vi.fn(),
}));
vi.mock("@/features/notifications/actions", () => ({
  saveNotificationSettingsAction: vi.fn(),
}));
import CustomersPage from "@/app/(dashboard)/panel/[organizationId]/clientes/page";
import CustomerPage from "@/app/(dashboard)/panel/[organizationId]/clientes/[customerId]/page";
import NotificationsPage from "@/app/(dashboard)/panel/[organizationId]/notificaciones/page";
const org = crypto.randomUUID(),
  id = crypto.randomUUID();
const context = {
  role: "owner",
  organization: { timezone: "America/Argentina/Buenos_Aires" },
};
const item = {
  id,
  organization_id: org,
  name: "Ana",
  email: "ana@example.test",
  phone: "",
  is_active: true,
  transactional_email: true,
  marketing_consent: false,
  consent_evidence: "",
  consent_updated_at: null,
  version: 1,
  created_at: "2026-10-21T12:00:00Z",
  updated_at: "2026-10-21T12:00:00Z",
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.list.mockResolvedValue({
    context,
    filters: { q: "", activity: "active", recurrence: "all", page: 0 },
    items: [
      { ...item, completed_visits: 2, total_reservations: 3, last_visit: null },
    ],
  });
  mocks.load.mockResolvedValue({
    context,
    item,
    preferences: item,
    summary: { completed_visits: 2, last_visit: null },
    history: [],
  });
  mocks.notifications.mockResolvedValue({ context, settings: null, jobs: [] });
  mocks.config.mockReturnValue({ canSend: false });
});
describe("pantallas de clientes y registro de avisos", () => {
  it("ofrece filtros, historial y alta con datos del negocio", async () => {
    render(
      await CustomersPage({
        params: Promise.resolve({ organizationId: org }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(
      screen.getByRole("link", { name: "Agregar cliente" }),
    ).toHaveAttribute("href", `/panel/${org}/clientes/nuevo`);
    expect(screen.getByRole("link", { name: "Ana" })).toHaveAttribute(
      "href",
      `/panel/${org}/clientes/${id}`,
    );
    expect(
      screen.getByText("2 visitas completadas · 3 reservas"),
    ).toBeVisible();
    expect(
      screen.getByLabelText("Buscar por nombre, email o teléfono"),
    ).toBeVisible();
  });
  it("owner puede corregir ficha y registrar preferencias explícitas, sin marketing predeterminado", async () => {
    render(
      await CustomerPage({
        params: Promise.resolve({ organizationId: org, customerId: id }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(screen.getByLabelText("Nombre")).toHaveValue("Ana");
    expect(
      screen.getByLabelText(
        "El cliente dio consentimiento expreso para marketing",
      ),
    ).not.toBeChecked();
    expect(
      screen.getByRole("heading", {
        name: "Historial de reservas y servicios",
      }),
    ).toBeVisible();
  });
  it("staff ve contacto e historial autorizado sin formularios de edición o consentimiento", async () => {
    mocks.load.mockResolvedValue({
      context: { ...context, role: "staff" },
      item,
      summary: { completed_visits: 1 },
      history: [],
    });
    render(
      await CustomerPage({
        params: Promise.resolve({ organizationId: org, customerId: id }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(screen.getByText("ana@example.test")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Guardar ficha" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Preferencias de comunicación" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/corresponden solo a tu agenda/)).toBeVisible();
  });
  it("distingue cola habilitada de envíos operativos y no habilita nada por defecto", async () => {
    render(
      await NotificationsPage({
        params: Promise.resolve({ organizationId: org }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "envíos están desactivados",
    );
    expect(
      screen.getByLabelText("Registrar avisos por email para este negocio"),
    ).not.toBeChecked();
    expect(
      screen.getByText(/no su llegada a la bandeja de entrada/),
    ).toBeVisible();
  });
});
