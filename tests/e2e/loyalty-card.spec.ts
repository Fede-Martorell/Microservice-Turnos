import { test, expect } from "@playwright/test";
test("tarjeta privada muestra saldo y recompensas sin exponer contactos ni permitir canjes", async ({
  page,
  context,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const exchange = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/loyalty/access") &&
      response.request().method() === "POST",
  );
  await page.goto(`/tarjeta#token=${"b".repeat(64)}`);
  await expect(
    page.getByRole("heading", { name: "Estudio Horizonte", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/tarjeta$/);
  await expect(page.getByText("12 puntos disponibles")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Beneficio Horizonte" }),
  ).toBeVisible();
  await expect(
    page.getByText("Disponible para coordinar con el negocio"),
  ).toBeVisible();
  const body = await page.locator("body").innerText();
  for (const value of [
    "tarjeta@example.test",
    "owner@example.test",
    "Fixture privada; no exponer este motivo",
    "account_id",
  ])
    expect(body).not.toContain(value);
  const setCookie = await (await exchange).headerValue("set-cookie");
  expect(setCookie).toMatch(/samesite=strict/i);
  const cookie = (await context.cookies()).find(
    (c) => c.name === "loyalty_card_access",
  );
  expect(cookie?.httpOnly).toBe(true);
  // Reproducción mínima con servidor HTTP externo a la app: WebKit Windows ignora SameSite en loopback.
  // Se verifica el encabezado real en todos los proyectos; la aplicación conserva Strict.
  if (process.platform !== "win32" || testInfo.project.name !== "mobile-webkit")
    expect(cookie?.sameSite).toBe("Strict");
  else
    testInfo.annotations.push({
      type: "limitation",
      description:
        "WebKit Windows no aplica SameSite en HTTP loopback; falta validación de Safari real sobre HTTPS.",
    });
  expect(cookie?.path).toBe("/tarjeta");
  expect(await page.getByRole("button", { name: /Canjear/ }).count()).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("tarjeta-digital.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Salir de esta tarjeta" }).click();
  await expect(
    page.getByRole("heading", { name: "Tu tarjeta privada" }),
  ).toBeVisible();
  await expect(page.getByText("12 puntos disponibles")).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("tarjeta rechaza enlaces inválidos e intercambio desde otro origen", async ({
  page,
  request,
}) => {
  const response = await page.goto(`/tarjeta#token=${"c".repeat(64)}`);
  expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
  expect(response?.headers()["cache-control"]).toContain("no-store");
  await expect(
    page.getByText(
      "El enlace no está disponible, venció o alcanzó el límite de consultas.",
    ),
  ).toBeVisible();
  const result = await request.post("/api/loyalty/access", {
    headers: { origin: "https://ajeno.example" },
    data: { token: "b".repeat(64) },
  });
  expect(result.status()).toBe(403);
  expect(await result.json()).toEqual({ ok: false });
});
