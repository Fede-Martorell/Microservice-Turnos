import { describe, expect, it } from "vitest";
import {
  bookingSettingsSchema,
  createAppointmentSchema,
} from "@/features/appointments/schema";
import {
  addDays,
  localDay,
  localTime,
  transitions,
} from "@/features/appointments/presentation";
describe("reservas: entrada y presentación temporal", () => {
  it("exige instantes con offset, datos reales y una clave de reintento", () => {
    const id = "00000000-0000-4000-8000-000000000001";
    const input = {
      service_id: id,
      staff_id: id,
      starts_at: "2027-03-14T03:00:00-04:00",
      customer_name: "Persona",
      customer_email: "persona@example.test",
      customer_phone: "",
      status: "pending",
      request_key: id,
    };
    expect(createAppointmentSchema.safeParse(input).success).toBe(true);
    for (const invalid of [
      { starts_at: "2027-03-14T02:30" },
      { request_key: "" },
      { customer_email: "no-es-email" },
      { status: "completed" },
    ])
      expect(
        createAppointmentSchema.safeParse({ ...input, ...invalid }).success,
      ).toBe(false);
  });
  it("respeta las ventanas de anticipación configuradas", () => {
    expect(
      bookingSettingsSchema.safeParse({
        min_advance_minutes: "0",
        max_advance_days: "90",
      }).success,
    ).toBe(true);
    for (const input of [
      { min_advance_minutes: 2000, max_advance_days: 1 },
      { min_advance_minutes: -1, max_advance_days: 90 },
      { min_advance_minutes: 0, max_advance_days: 366 },
    ])
      expect(bookingSettingsSchema.safeParse(input).success).toBe(false);
  });
  it("muestra la fecha del negocio y distingue las horas repetidas de DST", () => {
    expect(
      localDay(
        "America/Argentina/Buenos_Aires",
        new Date("2026-10-22T01:00:00Z"),
      ),
    ).toBe("2026-10-21");
    expect(localTime("2026-11-01T05:00:00Z", "America/New_York")).not.toBe(
      localTime("2026-11-01T06:00:00Z", "America/New_York"),
    );
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2028-12-31", 1)).toBe("2029-01-01");
    expect(transitions.completed).toEqual([]);
    expect(transitions.canceled).toEqual([]);
    expect(transitions.no_show).toEqual([]);
  });
});
