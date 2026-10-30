import { z } from "zod";

export const weekdays = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
export function minuteInput(value: number) {
  return `${Math.floor(value / 60)
    .toString()
    .padStart(2, "0")}:${(value % 60).toString().padStart(2, "0")}`;
}
export function parseClock(value: string) {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value) && value !== "24:00")
    return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours! * 60 + minutes!;
}
const clock = z
  .string()
  .refine(
    (value) => parseClock(value) !== null,
    "Usá HH:mm, por ejemplo 09:00",
  );
export const availabilityRuleSchema = z
  .object({
    weekday: z.coerce.number().int().min(0).max(6),
    kind: z.enum(["working", "break"]),
    start: clock,
    end: clock,
  })
  .superRefine((value, ctx) => {
    const start = parseClock(value.start),
      end = parseClock(value.end);
    if (start !== null && end !== null && (start >= end || start === 1440))
      ctx.addIssue({
        code: "custom",
        path: ["end"],
        message: "El fin debe ser posterior al inicio, dentro del mismo día",
      });
  });
export const availabilityExceptionSchema = z
  .object({
    starts_on: z.iso.date("Elegí una fecha válida"),
    ends_on: z.iso.date("Elegí una fecha válida"),
    start: z.union([clock, z.literal("")]),
    end: z.union([clock, z.literal("")]),
    kind: z.enum(["blocked", "vacation", "holiday"]),
    reason: z.string().trim().max(500),
  })
  .superRefine((value, ctx) => {
    const days =
      (Date.parse(value.ends_on) - Date.parse(value.starts_on)) / 86400000;
    if (days < 0 || days > 366)
      ctx.addIssue({
        code: "custom",
        path: ["ends_on"],
        message:
          "Elegí un rango de hasta 367 días, con fin posterior o igual al inicio",
      });
    if (Boolean(value.start) !== Boolean(value.end))
      ctx.addIssue({
        code: "custom",
        path: ["end"],
        message: "Completá ambas horas o dejá ambas vacías",
      });
    if (
      value.start &&
      value.end &&
      (parseClock(value.start) ?? 0) >= (parseClock(value.end) ?? 0)
    )
      ctx.addIssue({
        code: "custom",
        path: ["end"],
        message: "El fin debe ser posterior al inicio",
      });
  });
