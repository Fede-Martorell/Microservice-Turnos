import { test, expect } from "@playwright/test";
test("resumen con SQL aislada: gráficos, fechas, configuración y estados vacíos", async ({
  page,
  request,
  context,
}, testInfo) => {
  const { org, token, user } = await (
    await request.get("http://127.0.0.1:54324/test-context")
  ).json();
  await context.addCookies([
    {
      name: "sb-127-auth-token",
      value: `base64-${Buffer.from(JSON.stringify({ access_token: token, refresh_token: "fixture-refresh", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user })).toString("base64url")}`,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const response = await page.goto(`/panel/${org}`);
  expect(response?.headers()["cache-control"]).toContain("no-store");
  await expect(
    page.getByRole("heading", { name: "Resumen del negocio", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Clientes recurrentes", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("heading", { name: "Reservas por día", exact: true })
    .scrollIntoViewIfNeeded();
  await expect(page.getByRole("application")).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Próximas reservas" })
      .getByRole("link", { name: "Cliente próximo · Consulta pública" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Actividad reciente" })
      .getByRole("link", { name: "Cliente resumen · Consulta pública" }),
  ).toBeVisible();
  await page.getByText("Ver datos diarios en tabla", { exact: true }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("resumen-negocio.png"),
    fullPage: true,
  });
  if (testInfo.project.name.startsWith("mobile")) {
    const viewport = page.viewportSize()!;
    await page.setViewportSize({ width: 320, height: 800 });
    // El gráfico reacciona al cambio de tamaño mediante ResizeObserver.
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
    await page.setViewportSize(viewport);
  }
  await page.getByRole("link", { name: "Últimos 7 días", exact: true }).click();
  await expect(page).toHaveURL(/desde=.*hasta=/);
  await page.getByLabel("Desde", { exact: true }).fill("2001-01-01");
  await page.getByLabel("Hasta", { exact: true }).fill("2001-01-02");
  await page.getByRole("button", { name: "Aplicar período" }).click();
  await expect(page.getByText("Sin actividad para graficar.")).toBeVisible();
  await expect(
    page.getByText("Todavía no hay reservas para este período.", {
      exact: false,
    }),
  ).toBeVisible();
  await page.goto(`/panel/${org}?desde=fecha-invalida&hasta=2026-10-01`);
  await expect(
    page.getByRole("alert").filter({ hasText: "Elegí un período válido" }),
  ).toContainText("Se muestran los últimos 30 días");
  await page.goto(`/panel/${org}/configuracion`);
  await expect(
    page.getByRole("heading", { name: "Estudio Horizonte", exact: true }),
  ).toBeVisible();
  await page.goto(`/panel/${org}/puesta-en-marcha`);
  await expect(
    page.getByRole("heading", { name: "Puesta en marcha", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("4 de 4 pasos completos")).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "4");
  await page.screenshot({
    path: testInfo.outputPath("puesta-en-marcha.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
