import { fireEvent, render, screen } from "@testing-library/react";
import { it, expect, vi } from "vitest";
import { AuthForm } from "@/components/auth/auth-form";
it("permite mostrar y ocultar la contraseña sin perder lo escrito ni enviarlo", () => {
  const action = vi.fn().mockResolvedValue({});
  render(<AuthForm mode="login" action={action} />);
  const input = screen.getByLabelText("Contraseña", { exact: true });
  fireEvent.change(input, { target: { value: "una frase privada" } });
  fireEvent.click(screen.getByRole("button", { name: "Mostrar contraseña" }));
  expect(input).toHaveAttribute("type", "text");
  expect(input).toHaveValue("una frase privada");
  expect(
    screen.getByRole("button", { name: "Ocultar contraseña" }),
  ).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Ocultar contraseña" }));
  expect(input).toHaveAttribute("type", "password");
  expect(action).not.toHaveBeenCalled();
});
