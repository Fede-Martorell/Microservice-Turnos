import { describe, expect, it } from "vitest";
import { parseMoney, priceInput } from "@/lib/utils/money";
import { serviceSchema } from "@/features/services/schema";
import {
  professionalSchema,
  invitationTokenSchema,
} from "@/features/staff/schema";
import {
  availabilityRuleSchema,
  availabilityExceptionSchema,
  parseClock,
} from "@/features/staff/availability-schema";

describe("importes exactos y catálogo", () => {
  it("respeta los decimales de cada moneda sin redondear entradas", () => {
    expect(parseMoney("123,45", "ARS")).toBe(12345);
    expect(parseMoney("0.29", "USD")).toBe(29);
    expect(parseMoney("1200", "JPY")).toBe(1200);
    expect(parseMoney("1.234", "KWD")).toBe(1234);
    expect(priceInput(29, "USD")).toBe("0.29");
    for (const value of [
      "1.234",
      "-1",
      "1e2",
      "1.000,50",
      "10000001",
      "Infinity",
    ])
      expect(parseMoney(value, "ARS")).toBeNull();
    expect(parseMoney("1.1", "JPY")).toBeNull();
    expect(parseMoney("10", "XYZ")).toBeNull();
  });
  it("valida duración, preparación, precio e imágenes seguras en servidor", () => {
    const service = {
      name: "Corte",
      description: "",
      category: "",
      duration_minutes: "30",
      preparation_minutes: "10",
      price: "15000,50",
      currency: "ARS",
      image_url: "",
      is_active: "true",
      staff_ids: [],
    };
    expect(serviceSchema.parse(service).duration_minutes).toBe(30);
    for (const invalid of [
      { duration_minutes: "4" },
      { duration_minutes: "30.5" },
      { preparation_minutes: "121" },
      { price: "1.234" },
      { image_url: "javascript:alert(1)" },
      { staff_ids: ["foreign"] },
    ])
      expect(serviceSchema.safeParse({ ...service, ...invalid }).success).toBe(
        false,
      );
    expect(
      professionalSchema.safeParse({
        name: "Ana",
        description: "",
        photo_url: "",
        user_id: "",
        is_active: "true",
        service_ids: [],
      }).success,
    ).toBe(true);
    expect(invitationTokenSchema.safeParse("a".repeat(64)).success).toBe(true);
    expect(invitationTokenSchema.safeParse("a".repeat(63)).success).toBe(false);
  });
});
describe("horarios locales y bloqueos", () => {
  it("admite tramos hasta medianoche y rechaza cruces, fracciones y horas ambiguas", () => {
    expect(parseClock("24:00")).toBe(1440);
    expect(parseClock("09:30")).toBe(570);
    for (const value of ["9:00", "24:01", "12:60", "-1:00"])
      expect(parseClock(value)).toBeNull();
    const rule = {
      weekday: "1",
      kind: "working",
      start: "18:00",
      end: "24:00",
    };
    expect(availabilityRuleSchema.safeParse(rule).success).toBe(true);
    for (const invalid of [
      { end: "09:00" },
      { start: "24:00" },
      { weekday: "7" },
      { weekday: "1.5" },
    ])
      expect(
        availabilityRuleSchema.safeParse({ ...rule, ...invalid }).success,
      ).toBe(false);
  });
  it("valida fechas reales, rangos inclusivos y el par de horas opcionales", () => {
    const exception = {
      starts_on: "2028-02-29",
      ends_on: "2028-02-29",
      start: "",
      end: "",
      kind: "vacation",
      reason: "",
    };
    expect(availabilityExceptionSchema.safeParse(exception).success).toBe(true);
    expect(
      availabilityExceptionSchema.safeParse({
        ...exception,
        start: "09:00",
        end: "12:00",
      }).success,
    ).toBe(true);
    for (const invalid of [
      { starts_on: "2027-02-29" },
      { ends_on: "2028-02-28" },
      { ends_on: "2030-01-01" },
      { start: "09:00" },
      { start: "12:00", end: "09:00" },
    ])
      expect(
        availabilityExceptionSchema.safeParse({ ...exception, ...invalid })
          .success,
      ).toBe(false);
  });
});
