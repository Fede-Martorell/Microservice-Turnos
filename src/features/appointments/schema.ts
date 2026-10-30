import { z } from "zod";
export const statusSchema = z.enum([
  "pending",
  "confirmed",
  "completed",
  "canceled",
  "no_show",
]);
export const createAppointmentSchema = z.object({
  service_id: z.uuid(),
  staff_id: z.uuid(),
  starts_at: z.iso.datetime({ offset: true }),
  customer_name: z.string().trim().min(2).max(100),
  customer_email: z.email().trim().toLowerCase().max(254),
  customer_phone: z.string().trim().max(30),
  status: z.enum(["pending", "confirmed"]),
  request_key: z.uuid(),
});
export const bookingSettingsSchema = z
  .object({
    min_advance_minutes: z.coerce.number().int().min(0).max(43200),
    max_advance_days: z.coerce.number().int().min(1).max(365),
  })
  .superRefine((value, ctx) => {
    if (value.min_advance_minutes > value.max_advance_days * 1440)
      ctx.addIssue({
        code: "custom",
        path: ["min_advance_minutes"],
        message: "La anticipación mínima debe entrar en la ventana máxima",
      });
  });
export const appointmentVersionSchema = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
});
