import { z } from "zod";
import { parseMoney } from "@/lib/utils/money";
export const subscriptionStatuses = {
  pilot: "Piloto gratuito",
  trial: "Prueba gratuita",
  active: "Activo",
  past_due: "Pendiente de renovación",
  canceled: "Cancelado",
  suspended: "Suspendido",
};
export const statusSchema = z.enum([
  "pilot",
  "trial",
  "active",
  "past_due",
  "canceled",
  "suspended",
]);
const day = z.iso.date();
const reason = z
  .string()
  .trim()
  .min(5, "Escribí un motivo de al menos 5 caracteres")
  .max(300);
export const periodSchema = z
  .object({ starts_on: day, ends_on: day, reason })
  .refine((v) => v.ends_on >= v.starts_on, {
    path: ["ends_on"],
    message: "La fecha final debe ser igual o posterior al inicio",
  });
export const planSchema = z
  .object({
    code: z.string().regex(/^[a-z][a-z0-9_-]{1,39}$/),
    name: z.string().trim().min(2).max(80),
    description: z.string().max(1000),
    price: z.string(),
    currency: z.string().regex(/^[A-Z]{3}$/),
    max_professionals: z.coerce.number().int().min(1).max(1000),
    is_active: z.boolean(),
    modules: z
      .array(z.string())
      .max(20)
      .refine((v) => v.includes("bookings"), "Incluí Agenda y reservas"),
  })
  .superRefine((v, c) => {
    if (parseMoney(v.price, v.currency) === null)
      c.addIssue({
        code: "custom",
        path: ["price"],
        message: "Ingresá un importe válido sin separador de miles",
      });
  });
export const subscriptionSchema = periodSchema.safeExtend({
  plan: z.string().min(2).max(40),
  status: statusSchema,
  notes: z.string().max(2000),
});
export const overrideSchema = periodSchema.safeExtend({
  module: z.string().min(2).max(40),
  enabled: z.boolean(),
});
export const feedbackSchema = z.object({
  problems: z.string().trim().max(1500),
  difficulty: z.coerce.number().int().min(1).max(5),
  requests: z.string().trim().max(1500),
  perceived_value: z.coerce.number().int().min(1).max(5),
  willing_to_pay: z.enum(["unknown", "yes", "no"]),
  suggestions: z.string().trim().max(1500),
});
export const organizationStatusSchema = z.object({
  status: z.enum(["active", "suspended", "archived"]),
  reason,
});
export const trialPolicySchema = z.object({
  plan: z.string().min(2).max(40),
  days: z.coerce.number().int().min(1).max(180),
});
