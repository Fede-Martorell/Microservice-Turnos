import { test, expect } from "@playwright/test";
import { buildNotificationMessage } from "../../src/features/notifications/template";
test("email transaccional legible en desktop y móvil, sin recursos externos", async ({
  page,
}, testInfo) => {
  const message = buildNotificationMessage(
    {
      id: crypto.randomUUID(),
      claim_token: crypto.randomUUID(),
      kind: "created",
      message: null,
      access: null,
      snapshot: {
        organization_name: "Estudio Horizonte",
        slug: "horizonte",
        customer_name: "Ana de prueba",
        customer_email: "ana@example.test",
        service_name: "Consulta personalizada",
        staff_name: "Profesional de prueba",
        starts_at: "2027-01-04T12:00:00Z",
        ends_at: "2027-01-04T12:30:00Z",
        timezone: "America/Argentina/Buenos_Aires",
        status: "confirmed",
        price_minor: 150000,
        currency: "ARS",
        contact_email: "contacto@example.test",
        contact_phone: "",
      },
    },
    "Reservas <onboarding@resend.dev>",
    "https://reservas.example/reserva#token=token_de_prueba",
  );
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.setContent(message.html);
  expect(await page.evaluate(() => window.innerWidth)).toBe(
    page.viewportSize()!.width,
  );
  await expect(
    page.getByRole("heading", { name: "Tu reserva está confirmada" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Consultar o gestionar mi reserva" }),
  ).toHaveAttribute(
    "href",
    "https://reservas.example/reserva#token=token_de_prueba",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(requests).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("email-confirmacion.png"),
    fullPage: true,
  });
});
