import { test, expect } from "@playwright/test";
test("reserva sin cuenta, enlace privado, reprogramación y cancelación", async ({
  page,
  context,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/b/horizonte");
  await expect(
    page.getByRole("heading", { name: "Estudio Horizonte", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("catalogo-publico.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "Elegir Consulta pública" }).click();
  const projectIndex = [
    "desktop-chromium",
    "mobile-chromium",
    "mobile-webkit",
  ].indexOf(testInfo.project.name);
  const day = new Date(Date.now() + (7 + projectIndex) * 86400000)
    .toISOString()
    .slice(0, 10);
  await page.getByLabel("Fecha", { exact: true }).fill(day);
  await page.getByRole("button", { name: "Ver horarios", exact: true }).click();
  await expect(page.getByLabel("Horario disponible")).toBeVisible();
  const slots = page.getByLabel("Horario disponible").locator("option");
  const count = await slots.count();
  await page
    .getByLabel("Horario disponible")
    .selectOption({ index: Math.min(testInfo.parallelIndex, count - 1) });
  await page
    .getByLabel("Tu nombre", { exact: true })
    .fill(`Persona ${testInfo.project.name}`);
  await page
    .getByLabel("Tu email", { exact: true })
    .fill(`${testInfo.project.name}@example.test`);
  await page.getByLabel("Leí y acepto la política de cancelación.").check();
  await page.screenshot({
    path: testInfo.outputPath("formulario-publico.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Solicitar reserva", exact: true })
    .click();
  await expect(
    page.getByText("Tu reserva está confirmada", { exact: true }),
  ).toBeVisible();
  const link = await page.getByLabel("Enlace privado de gestión").inputValue();
  expect(new URL(link).hash).toMatch(/^#token=[0-9a-f]{64}$/);
  await page.getByRole("link", { name: "Ver y gestionar mi reserva" }).click();
  await expect(
    page.getByRole("heading", { name: "Reprogramar mi turno" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/reserva$/);
  const cookie = (await context.cookies()).find(
    (item) => item.name === "booking_management",
  );
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.path).toBe("/reserva");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("gestion-publica.png"),
    fullPage: true,
  });
  const reschedule = page.getByRole("combobox", {
    name: new RegExp(`Horario para ${day}`),
  });
  const choices = await reschedule.locator("option").count();
  await reschedule.selectOption({
    index: Math.max(0, choices - 1 - testInfo.parallelIndex),
  });
  const newTime = await reschedule.locator("option:checked").textContent();
  await page
    .getByRole("button", { name: "Guardar nuevo horario", exact: true })
    .click();
  await expect(
    page.getByRole("definition").filter({ hasText: newTime! }),
  ).toBeVisible();
  await page.getByLabel("Quiero cancelar esta reserva").check();
  await page
    .getByRole("button", { name: "Confirmar cancelación", exact: true })
    .click();
  await expect(
    page.getByText("Tu reserva está cancelada.", { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("no permite acceso ajeno ni intercambio desde otro origen", async ({
  page,
  request,
}) => {
  const response = await request.post("/api/public-booking/access", {
    headers: { origin: "https://attacker.example" },
    data: { token: "f".repeat(64) },
  });
  expect(response.status()).toBe(403);
  await page.goto(`/reserva#token=${"f".repeat(64)}`);
  await expect(page.getByRole("status")).toContainText(
    "El enlace no está disponible",
  );
  await expect(
    page.getByRole("heading", { name: "Reprogramar mi turno" }),
  ).toHaveCount(0);
  await expect(page).toHaveURL(/\/reserva$/);
});
