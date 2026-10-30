import { fireEvent, render, screen, within } from "@testing-library/react";
import { it, expect, vi } from "vitest";
const org = "00000000-0000-4000-8000-000000000011";
vi.mock("next/navigation", () => ({
  usePathname: () => "/panel/00000000-0000-4000-8000-000000000011",
}));
import { WorkspaceShell } from "@/components/layout/workspace-shell";
it("el menú unificado respeta módulos y marca solamente la pantalla actual", () => {
  render(
    <WorkspaceShell role="owner" modules={["bookings", "public_booking"]}>
      <h1>Contenido</h1>
    </WorkspaceShell>,
  );
  const nav = within(
    screen.getByRole("navigation", { name: "Navegación principal" }),
  );
  expect(
    nav.getByRole("link", { name: "Resumen y estadísticas" }),
  ).toHaveAttribute("aria-current", "page");
  expect(
    nav.getByRole("link", { name: "Mis organizaciones" }),
  ).not.toHaveAttribute("aria-current");
  expect(nav.getByRole("link", { name: "Página pública" })).toHaveAttribute(
    "href",
    `/panel/${org}/pagina-publica`,
  );
  expect(
    nav.queryByRole("link", { name: "Fidelización" }),
  ).not.toBeInTheDocument();
  expect(
    nav.queryByRole("link", { name: "Notificaciones" }),
  ).not.toBeInTheDocument();
});
it("personal no ve controles de propietario y Escape devuelve foco al botón del menú", () => {
  render(
    <WorkspaceShell
      role="staff"
      modules={["bookings", "public_booking", "notifications", "loyalty"]}
    >
      <h1>Mi agenda</h1>
    </WorkspaceShell>,
  );
  const nav = within(
    screen.getByRole("navigation", { name: "Navegación principal" }),
  );
  for (const name of [
    "Página pública",
    "Fidelización",
    "Suscripción",
    "Notificaciones",
    "Resumen y estadísticas",
  ])
    expect(nav.queryByRole("link", { name })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
  fireEvent.keyDown(
    screen.getByRole("navigation", { name: "Navegación móvil" }),
    { key: "Escape" },
  );
  expect(
    screen.queryByRole("navigation", { name: "Navegación móvil" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Abrir menú" })).toHaveFocus();
});
