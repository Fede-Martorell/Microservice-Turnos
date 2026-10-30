import { render, screen, fireEvent } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import ErrorPage from "@/app/error";
it("permite reintentar y recuperar navegación sin revelar el mensaje privado", () => {
  const reset = vi.fn();
  render(
    <ErrorPage
      error={Object.assign(new Error("private-provider-message"), {
        digest: "123456",
      })}
      reset={reset}
    />,
  );
  expect(
    screen.queryByText("private-provider-message"),
  ).not.toBeInTheDocument();
  expect(
    screen.getByText("Referencia para soporte: 123456"),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  expect(reset).toHaveBeenCalledOnce();
  expect(
    screen.getByRole("link", { name: "Volver a mis organizaciones" }),
  ).toHaveAttribute("href", "/panel");
});
