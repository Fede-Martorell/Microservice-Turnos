import { expect, test } from "@playwright/test";

test("panel privado sin sesión redirige y nunca publica contenido protegido", async ({
  page,
  request,
}, testInfo) => {
  for (const path of [
    "/admin",
    "/admin/planes",
    "/admin/auditoria",
    "/admin/negocios/00000000-0000-4000-8000-000000000001",
    "/panel",
    "/panel/organizaciones/nueva",
    "/panel/00000000-0000-4000-8000-000000000001",
    "/panel/00000000-0000-4000-8000-000000000001/configuracion",
    "/panel/00000000-0000-4000-8000-000000000001/puesta-en-marcha",
    "/panel/00000000-0000-4000-8000-000000000001/servicios/nuevo",
    "/panel/00000000-0000-4000-8000-000000000001/equipo",
    "/panel/00000000-0000-4000-8000-000000000001/disponibilidad",
    "/panel/00000000-0000-4000-8000-000000000001/calendario",
    "/panel/00000000-0000-4000-8000-000000000001/clientes",
    "/panel/00000000-0000-4000-8000-000000000001/clientes/nuevo",
    "/panel/00000000-0000-4000-8000-000000000001/clientes/00000000-0000-4000-8000-000000000002",
    "/panel/00000000-0000-4000-8000-000000000001/notificaciones",
    "/panel/00000000-0000-4000-8000-000000000001/suscripcion",
    "/panel/00000000-0000-4000-8000-000000000001/fidelizacion",
    "/panel/00000000-0000-4000-8000-000000000001/fidelizacion/configurar",
    "/panel/00000000-0000-4000-8000-000000000001/fidelizacion/recompensas/nueva",
    "/panel/00000000-0000-4000-8000-000000000001/fidelizacion/clientes/00000000-0000-4000-8000-000000000002",
    "/panel/00000000-0000-4000-8000-000000000001/reservas/nueva",
    "/panel/00000000-0000-4000-8000-000000000001/reservas/00000000-0000-4000-8000-000000000002",
  ]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toContain("/ingresar");
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
  await page.goto("/panel");
  await expect(page).toHaveURL(/\/ingresar$/);
  await expect(
    page.getByRole("heading", { name: "Bienvenido a tu espacio" }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("ingresar.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "Crear cuenta", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Creá tu cuenta" }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("registro.png"),
    fullPage: true,
  });
  if (process.env.E2E_USE_CONFIGURED_SUPABASE === "1") {
    await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
    await page.getByLabel("Email", { exact: true }).fill("persona@example.com");
    await page.getByLabel("Contraseña", { exact: true }).fill("corta");
    await page
      .getByRole("button", { name: "Crear cuenta", exact: true })
      .click();
    await expect(page).toHaveURL(/\/registro$/);
    expect(
      await page
        .getByLabel("Contraseña", { exact: true })
        .evaluate((element) => (element as HTMLInputElement).checkValidity()),
    ).toBe(false);
  } else {
    await expect(
      page.getByText("Acceso pendiente de configuración"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Crear cuenta", exact: true }),
    ).toHaveCount(0);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.goto(`/invitacion?token=${"a".repeat(64)}`);
  await expect(
    page.getByRole("heading", { name: "Invitación al equipo" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Ingresar", exact: true }),
  ).toHaveAttribute("href", "/ingresar");
  await expect(
    page.getByRole("button", { name: "Aceptar acceso de personal" }),
  ).toHaveCount(0);
});

test("invitación inválida no revela datos y evita cache y referrer", async ({
  page,
}) => {
  const response = await page.goto(
    "/invitacion?token=invalido&next=https://example.com",
  );
  expect(response?.status()).toBe(200);
  expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
  expect(response?.headers()["cache-control"]).toContain("no-store");
  await expect(
    page.getByRole("heading", { name: "Invitación no disponible" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Aceptar acceso de personal" }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("confirmación sin token falla con redirección interna y no admite next externo", async ({
  request,
}) => {
  const response = await request.get("/auth/confirm?next=https://example.com", {
    maxRedirects: 0,
  });
  expect(response.status()).toBe(307);
  const target = new URL(response.headers().location!);
  expect(target.pathname).toBe("/ingresar");
  expect(["127.0.0.1", "localhost"]).toContain(target.hostname);
  expect(target.port).toBe("3100");
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(response.headers()["referrer-policy"]).toBe("no-referrer");
});
