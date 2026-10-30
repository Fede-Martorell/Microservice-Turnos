import { describe, it, expect } from "vitest";
import {
  buildNotificationMessage,
  type NotificationClaim,
} from "@/features/notifications/template";
import { customerSchema, preferencesSchema } from "@/features/customers/schema";
const job: NotificationClaim = {
  id: crypto.randomUUID(),
  claim_token: crypto.randomUUID(),
  kind: "created",
  message: null,
  access: null,
  snapshot: {
    organization_name: "Negocio <script>",
    slug: "negocio",
    customer_name: "Ana & Luis",
    customer_email: "ana@example.test",
    service_name: "Consulta",
    staff_name: "Profesional",
    starts_at: "2026-12-10T12:00:00Z",
    ends_at: "2026-12-10T12:30:00Z",
    timezone: "America/Argentina/Buenos_Aires",
    status: "pending",
    price_minor: 150000,
    currency: "ARS",
    contact_email: "negocio@example.test",
    contact_phone: "",
  },
};
describe("plantillas transaccionales y fichas", () => {
  it("escapa contenido, conserva la zona del turno y distingue solicitud pendiente", () => {
    const message = buildNotificationMessage(
      job,
      "Reservas <onboarding@resend.dev>",
      "https://reservas.example/reserva#token=abc",
    );
    expect(message.to).toBe("ana@example.test");
    expect(message.html).toContain("&lt;script&gt;");
    expect(message.html).not.toContain("<script>");
    expect(message.html).toContain("Ana &amp; Luis");
    expect(message.text).toContain("09:00");
    expect(message.text).toContain("pendiente");
    expect(message.text).toContain("#token=abc");
    expect(message.text).toContain("no es una suscripción a marketing");
  });
  it.each(["confirmed", "canceled", "rescheduled", "reminder"] as const)(
    "genera el evento %s sin prometer pago o entrega",
    (kind) => {
      const message = buildNotificationMessage(
        {
          ...job,
          kind,
          snapshot: {
            ...job.snapshot,
            status: kind === "canceled" ? "canceled" : "confirmed",
          },
        },
        "Reservas <onboarding@resend.dev>",
        null,
      );
      expect(message.text).toContain("no indica un pago");
      expect(message.text).not.toContain("#token");
      expect(message.text).not.toContain("pendiente de confirmación");
    },
  );
  it("normaliza email y exige evidencia para registrar marketing sin concederlo por defecto", () => {
    expect(
      customerSchema.parse({
        name: " Ana ",
        email: " ANA@EXAMPLE.TEST ",
        phone: "",
        is_active: "true",
      }).email,
    ).toBe("ana@example.test");
    expect(
      preferencesSchema.safeParse({
        transactional_email: "true",
        marketing_consent: "true",
        consent_evidence: "",
      }).success,
    ).toBe(false);
    expect(
      preferencesSchema.parse({
        transactional_email: "false",
        marketing_consent: "false",
        consent_evidence: "",
      }).marketing_consent,
    ).toBe(false);
  });
});
