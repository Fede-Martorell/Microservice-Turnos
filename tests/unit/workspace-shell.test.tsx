import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceShell } from "@/components/layout/workspace-shell";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

describe("navegación inicial", () => {
  it("permite abrir y cerrar el menú compacto con un enlace al proyecto", () => {
    render(
      <WorkspaceShell>
        <h1>Contenido de inicio</h1>
      </WorkspaceShell>,
    );
    const toggle = screen.getByRole("button", { name: "Abrir menú" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(
      screen.getByRole("navigation", { name: "Navegación móvil" }),
    ).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(
      within(
        screen.getByRole("navigation", { name: "Navegación móvil" }),
      ).getByRole("link", { name: "Estado del proyecto" }),
    ).toHaveAttribute("href", "/proyecto");
    fireEvent.click(screen.getByRole("button", { name: "Cerrar menú" }));
    expect(
      screen.queryByRole("navigation", { name: "Navegación móvil" }),
    ).not.toBeInTheDocument();
  });
});
