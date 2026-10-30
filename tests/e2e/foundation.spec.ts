import { expect, test } from "@playwright/test";

test("inicio honesto, navegación y diseño sin desbordes", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Tu negocio, en su mejor momento." }),
  ).toBeVisible();
  await expect(
    page.getByText("Creá tu cuenta e ingresá al panel", {
      exact: false,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  if (testInfo.project.name.startsWith("mobile")) {
    await page.getByRole("button", { name: "Abrir menú" }).click();
    await page
      .getByRole("navigation", { name: "Navegación móvil" })
      .getByRole("link", { name: "Estado del proyecto" })
      .click();
  } else {
    await page.getByRole("link", { name: "Ver hoja de ruta" }).click();
  }
  await expect(page).toHaveURL(/\/proyecto/);
  await expect(
    page.getByRole("heading", { name: "Hoja de ruta" }),
  ).toBeVisible();
  await expect(
    page.getByText("Los pagos todavía no están implementados", {
      exact: false,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("proyecto.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "Volver al inicio" }).click();
  await expect(
    page.getByRole("heading", { name: "Tu negocio, en su mejor momento." }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("inicio.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
  if (testInfo.project.name.startsWith("mobile")) {
    await page.setViewportSize({ width: 320, height: 800 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath("inicio-compacto.png"),
      fullPage: true,
    });
  }
});

test("manifest, iconos, cabeceras y página inexistente", async ({
  page,
  request,
}) => {
  const response = await request.get("/");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(health.headers()["cache-control"]).toContain("no-store");
  expect((await health.json()).dependencies).toBe("not_checked");
  const manifestResponse = await request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  expect(manifest.display).toBe("standalone");
  for (const icon of manifest.icons) {
    const iconResponse = await request.get(icon.src);
    expect(iconResponse.ok()).toBe(true);
    expect(iconResponse.headers()["content-type"]).toContain("image/png");
  }
  const missing = await page.goto("/pagina-inexistente");
  expect(missing?.status()).toBe(404);
  await expect(
    page.getByRole("link", { name: "Volver al inicio" }),
  ).toBeVisible();
});
