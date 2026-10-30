import { z } from "zod";
import { addDays, localDay } from "@/features/appointments/presentation";
import { statusSchema } from "@/features/appointments/schema";

const date = z.iso
  .date()
  .min(10)
  .max(10)
  .refine((v) => v >= "2000-01-01" && v <= "2100-12-31");
export const periodSchema = z
  .object({ from: date, to: date })
  .refine(
    (v) =>
      v.to >= v.from &&
      (Date.parse(v.to) - Date.parse(v.from)) / 86400000 <= 92,
  );
export function dashboardPeriod(
  query: Record<string, string | string[] | undefined>,
  zone: string,
  now = new Date(),
) {
  const today = localDay(zone, now);
  const fallback = { from: addDays(today, -29), to: today };
  if (query.desde === undefined && query.hasta === undefined)
    return { period: fallback, invalid: false };
  const parsed = periodSchema.safeParse({ from: query.desde, to: query.hasta });
  return {
    period: parsed.success ? parsed.data : fallback,
    invalid: !parsed.success,
  };
}
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const countsSchema = z.object({
  total: count,
  pending: count,
  confirmed: count,
  completed: count,
  canceled: count,
  no_show: count,
});
const instant = z.iso.datetime({ offset: true });
export const dashboardSchema = z.object({
  as_of: instant,
  timezone: z.string(),
  today: date,
  from: date,
  to: date,
  counts: countsSchema,
  today_counts: countsSchema,
  customers: z.object({ attended: count, recurring: count }),
  series: z
    .array(
      z.object({ day: date, total: count, completed: count, canceled: count }),
    )
    .min(1)
    .max(93),
  services: z
    .array(
      z.object({
        service_id: z.uuid(),
        name: z.string(),
        total: count,
        completed: count,
      }),
    )
    .max(5),
  upcoming: z
    .array(
      z.object({
        id: z.uuid(),
        customer_name: z.string(),
        service_name: z.string(),
        staff_name: z.string(),
        starts_at: instant,
        status: z.enum(["pending", "confirmed"]),
      }),
    )
    .max(5),
  activity: z
    .array(
      z.object({
        id: z.uuid(),
        appointment_id: z.uuid(),
        event: z.enum(["created", "rescheduled", "status_changed"]),
        to_status: statusSchema,
        created_at: instant,
        customer_name: z.string(),
        service_name: z.string(),
      }),
    )
    .max(10),
});
export type BusinessDashboard = z.infer<typeof dashboardSchema>;
