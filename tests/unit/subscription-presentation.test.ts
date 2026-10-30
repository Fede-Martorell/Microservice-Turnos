import { it, expect } from "vitest";
import {
  formatTimestamp,
  lastDay,
} from "@/features/subscriptions/presentation";
it("la auditoría distingue 16 de 04 horas aunque es-AR omita el período del día", () => {
  expect(formatTimestamp("2026-10-22T16:20:06Z", "UTC")).toContain("16:20:06");
  expect(
    formatTimestamp("2026-10-22T16:20:06Z", "America/Argentina/Buenos_Aires"),
  ).toContain("13:20:06");
  expect(formatTimestamp("2026-10-22T00:20:06Z", "UTC")).toContain("00:20:06");
});
it("el último día inclusive se calcula antes del fin exclusivo en la zona del negocio", () => {
  expect(
    lastDay("2026-11-22T03:00:00Z", "America/Argentina/Buenos_Aires"),
  ).toBe("2026-11-21");
});
