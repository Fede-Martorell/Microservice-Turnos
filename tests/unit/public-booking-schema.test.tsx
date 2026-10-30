import { describe, expect, it } from "vitest";
import {
  bookingInputSchema,
  settingsSchema,
} from "@/features/public-booking/schema";
import { contrastText } from "@/components/public-booking/public-shell";
describe("entrada pública y contraste", () => {
  it("valida consentimiento operativo, email, nonce y campo de control", () => {
    const input = {
      request_key: "00000000-0000-4000-8000-000000000001",
      starts_at: "2027-01-01T12:00:00Z",
      customer_name: "Persona",
      customer_email: " PERSONA@example.test ",
      customer_phone: "",
      accept_policy: true,
      website: "",
    };
    expect(bookingInputSchema.parse(input).customer_email).toBe(
      "persona@example.test",
    );
    for (const invalid of [
      { accept_policy: false },
      { website: "spam" },
      { request_key: "x" },
      { starts_at: "2027-01-01T09:00" },
      { customer_name: "x" },
    ])
      expect(
        bookingInputSchema.safeParse({ ...input, ...invalid }).success,
      ).toBe(false);
  });
  it("rechaza colores CSS arbitrarios, enlaces inseguros y publicación sin política", () => {
    const input = {
      enabled: "true",
      auto_confirm: "false",
      contact_email: "",
      contact_phone: "",
      address: "",
      cancellation_policy: "Cambios con 24 horas de anticipación.",
      cancellation_notice_minutes: "1440",
      logo_url: "",
      cover_url: "",
      primary_color: "#355741",
      secondary_color: "#eaf0e6",
    };
    expect(settingsSchema.parse(input).enabled).toBe(true);
    for (const invalid of [
      { primary_color: "red;background:url(x)" },
      { cover_url: "javascript:alert(1)" },
      { cancellation_policy: "" },
      { cancellation_notice_minutes: "-1" },
    ])
      expect(settingsSchema.safeParse({ ...input, ...invalid }).success).toBe(
        false,
      );
  });
  it("usa negro o blanco según el fondo elegido", () => {
    expect(contrastText("#ffffff")).toBe("#000000");
    expect(contrastText("#000000")).toBe("#ffffff");
    expect(contrastText("#355741")).toBe("#ffffff");
    expect(contrastText("#eaf0e6")).toBe("#000000");
  });
});
