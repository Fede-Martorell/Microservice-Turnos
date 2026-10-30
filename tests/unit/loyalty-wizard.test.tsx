import { fireEvent, render, screen } from "@testing-library/react";
import { it, expect, vi } from "vitest";
vi.mock("@/features/loyalty/actions", () => ({
  saveLoyaltyProgramAction: vi.fn(),
}));
import { ProgramWizard } from "@/components/loyalty/program-wizard";
it("ofrece ejemplos editables sin imponer la modalidad ni activar el programa", () => {
  render(
    <ProgramWizard
      org={crypto.randomUUID()}
      config={{
        program: null,
        rule: null,
        services: [],
        rewards: [],
        mode_locked: false,
      }}
      services={[
        { id: crypto.randomUUID(), name: "Consulta", is_active: true },
        { id: crypto.randomUUID(), name: "Sesión", is_active: true },
      ]}
      today="2026-10-22"
      lastDay="2027-10-22"
    />,
  );
  fireEvent.click(screen.getByRole("radio", { name: /Puntos por servicio/ }));
  fireEvent.click(screen.getByRole("button", { name: "Configurar reglas" }));
  expect(screen.getByLabelText("Puntos: Consulta")).toHaveValue(0);
  fireEvent.click(
    screen.getByRole("button", {
      name: "Cargar ejemplo editable de servicios",
    }),
  );
  expect(screen.getByLabelText("Puntos: Consulta")).toHaveValue(1);
  expect(screen.getByLabelText("Puntos: Sesión")).toHaveValue(3);
  expect(
    screen.getByLabelText("Activar el programa al guardar"),
  ).not.toBeChecked();
  fireEvent.change(screen.getByLabelText("Puntos: Consulta"), {
    target: { value: "7" },
  });
  expect(screen.getByLabelText("Puntos: Consulta")).toHaveValue(7);
});
