import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActionForm } from "@/components/ui/action-form";
import type { ActionState } from "@/types/actions";
import { LicenseProvider } from "@/components/subscriptions/license-context";

describe("formularios de catálogo", () => {
  it("bloquea cambios sin módulo y mantiene operativas las acciones permitidas de cancelación", async () => {
    const action = vi.fn(async () => ({ success: true, message: "Cancelada" }));
    render(
      <LicenseProvider modules={[]}>
        <ActionForm
          action={action}
          fields={[{ name: "name", label: "Nombre" }]}
          submitLabel="Guardar"
        />
        <ActionForm
          action={action}
          fields={[]}
          requiresModule={false}
          submitLabel="Cancelar reserva"
        />
      </LicenseProvider>,
    );
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
    expect(screen.getByLabelText("Nombre")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Cancelar reserva" }),
    ).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar reserva" }));
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
  });
  it("envía selecciones múltiples, estado y precio decimal sin perder datos", async () => {
    const action = vi.fn(async (_state: ActionState, data: FormData) => {
      expect(data.getAll("staff_ids")).toEqual(["ana", "luis"]);
      expect(data.get("is_active")).toBe("false");
      expect(data.get("price")).toBe("0,29");
      return { success: true, message: "Guardado" };
    });
    render(
      <ActionForm
        action={action}
        fields={[
          {
            name: "staff_ids",
            label: "Equipo",
            type: "checklist",
            value: ["ana"],
            options: [
              { value: "ana", label: "Ana" },
              { value: "luis", label: "Luis" },
            ],
          },
          { name: "is_active", label: "Activo", type: "checkbox", value: true },
          { name: "price", label: "Precio", value: "0,29" },
        ]}
        submitLabel="Guardar"
      />,
    );
    fireEvent.click(screen.getByLabelText("Luis"));
    fireEvent.click(screen.getByLabelText("Activo"));
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Guardado"),
    );
    expect(action).toHaveBeenCalledOnce();
  });
  it("conserva campos inválidos y muestra el error devuelto por el servidor", async () => {
    render(
      <ActionForm
        action={async () => ({
          errors: { price: ["Importe inválido"] },
          message: "Revisá el importe",
        })}
        fields={[{ name: "price", label: "Precio", value: "1.234" }]}
        submitLabel="Guardar"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() =>
      expect(screen.getByText("Importe inválido")).toBeVisible(),
    );
    expect(screen.getByLabelText("Precio")).toHaveValue("1.234");
    expect(screen.getByLabelText("Precio")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });
});
