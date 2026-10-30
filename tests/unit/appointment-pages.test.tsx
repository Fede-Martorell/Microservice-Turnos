import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
const mocks = vi.hoisted(() => ({
  catalog: vi.fn(),
  slots: vi.fn(),
  calendar: vi.fn(),
  requireOrganization: vi.fn(),
  create: vi.fn(),
}));
vi.mock("@/components/layout/organization-screen", () => ({
  OrganizationScreen: ({ children }: { children: ReactNode }) => (
    <main>{children}</main>
  ),
}));
vi.mock("@/features/services/queries", () => ({ loadCatalog: mocks.catalog }));
vi.mock("@/features/appointments/queries", () => ({
  loadSlots: mocks.slots,
  loadCalendar: mocks.calendar,
}));
vi.mock("@/features/organizations/queries", () => ({
  requireOrganization: mocks.requireOrganization,
}));
vi.mock("@/features/appointments/actions", () => ({
  createAppointmentAction: mocks.create,
}));
import NewAppointmentPage from "@/app/(dashboard)/panel/[organizationId]/reservas/nueva/page";
import CalendarPage from "@/app/(dashboard)/panel/[organizationId]/calendario/page";
const org = "00000000-0000-4000-8000-000000000001",
  staff = "00000000-0000-4000-8000-000000000002",
  service = "00000000-0000-4000-8000-000000000003";
const day = "2027-01-05";
const context = {
  role: "owner",
  organization: { timezone: "America/Argentina/Buenos_Aires" },
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireOrganization.mockResolvedValue(context);
  mocks.catalog.mockResolvedValue({
    context,
    services: [
      {
        id: service,
        name: "Consulta",
        is_active: true,
        duration_minutes: 30,
        preparation_minutes: 10,
        price_minor: 250050,
        currency: "ARS",
      },
    ],
    professionals: [{ id: staff, name: "Ana", is_active: true }],
    assignments: [{ staff_id: staff, service_id: service }],
  });
  mocks.slots.mockResolvedValue({
    slots: [
      {
        starts_at: `${day}T12:00:00Z`,
        ends_at: `${day}T12:30:00Z`,
        occupied_until: `${day}T12:40:00Z`,
      },
    ],
  });
  mocks.create.mockResolvedValue({ success: true, message: "Creada" });
});
describe("pantallas de reservas con datos sintéticos y adaptadores aislados", () => {
  it("muestra selección y precio y envía el instante UTC con una clave de reintento", async () => {
    render(
      await NewAppointmentPage({
        params: Promise.resolve({ organizationId: org }),
        searchParams: Promise.resolve({ fecha: day }),
      }),
    );
    expect(
      screen.getByRole("heading", { name: "Consulta · Ana" }),
    ).toBeVisible();
    fireEvent.change(screen.getByLabelText("Nombre del cliente"), {
      target: { value: "Persona de prueba" },
    });
    fireEvent.change(screen.getByLabelText("Email del cliente"), {
      target: { value: "persona@example.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear reserva" }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
    const [organization, , data] = mocks.create.mock.calls[0]!;
    expect(organization).toBe(org);
    expect(data.get("staff_id")).toBe(staff);
    expect(data.get("service_id")).toBe(service);
    expect(data.get("starts_at")).toBe(`${day}T12:00:00Z`);
    expect(data.get("request_key")).toMatch(/^[0-9a-f-]{36}$/);
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Creada"),
    );
  });
  it("no cambia silenciosamente a otro profesional si la selección no ofrece el servicio", async () => {
    render(
      await NewAppointmentPage({
        params: Promise.resolve({ organizationId: org }),
        searchParams: Promise.resolve({ fecha: day, profesional: org }),
      }),
    );
    expect(mocks.slots).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "Crear reserva" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "profesional que lo ofrezca",
    );
  });
  it("agrupa la semana según fecha local y aplica el filtro de estado", async () => {
    const common = {
      staff_id: staff,
      staff_name: "Ana",
      service_name: "Consulta",
      customer_name: "Persona",
      starts_at: `${day}T12:00:00Z`,
      ends_at: `${day}T12:30:00Z`,
    };
    mocks.calendar.mockResolvedValue({
      context,
      items: [
        { ...common, id: service, status: "confirmed" },
        { ...common, id: staff, status: "canceled" },
      ],
    });
    render(
      await CalendarPage({
        params: Promise.resolve({ organizationId: org }),
        searchParams: Promise.resolve({
          fecha: day,
          vista: "semana",
          estado: "confirmed",
        }),
      }),
    );
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(7);
    expect(screen.getAllByText("Consulta · Ana")).toHaveLength(1);
    expect(
      screen.getByRole("link", { name: /09:00.*Consulta/ }),
    ).toHaveAttribute("href", `/panel/${org}/reservas/${service}`);
  });
});
