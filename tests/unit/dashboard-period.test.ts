import { it, expect } from "vitest";
import { dashboardPeriod, periodSchema } from "@/features/dashboard/schema";
it("elige últimos treinta días según la fecha local, incluso en cambio de año", () => {
  expect(
    dashboardPeriod(
      {},
      "America/Argentina/Buenos_Aires",
      new Date("2027-01-01T01:00:00Z"),
    ),
  ).toEqual({
    period: { from: "2026-12-02", to: "2026-12-31" },
    invalid: false,
  });
});
it("acepta hasta 93 fechas inclusive y rechaza fechas inexistentes o repetidas", () => {
  expect(
    periodSchema.safeParse({ from: "2026-01-01", to: "2026-04-03" }).success,
  ).toBe(true);
  for (const period of [
    { from: "2026-01-01", to: "2026-04-04" },
    { from: "2026-02-30", to: "2026-03-01" },
    { from: "2026-03-01", to: "2026-02-28" },
  ])
    expect(periodSchema.safeParse(period).success).toBe(false);
  expect(
    dashboardPeriod(
      { desde: ["2026-01-01", "2026-01-02"], hasta: "2026-01-02" },
      "UTC",
    ).invalid,
  ).toBe(true);
});
it("avisa y usa un período seguro ante filtros incompletos", () => {
  const result = dashboardPeriod(
    { desde: "2026-10-01" },
    "UTC",
    new Date("2026-10-23T12:00Z"),
  );
  expect(result).toEqual({
    period: { from: "2026-09-24", to: "2026-10-23" },
    invalid: true,
  });
});
