import { z } from "zod";
import { httpsUrlSchema, activeSchema } from "@/features/services/schema";
import { statusSchema } from "@/features/appointments/schema";
export const slugSchema = z
  .string()
  .regex(/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/)
  .min(3)
  .max(63);
export const tokenSchema = z.string().regex(/^[0-9a-f]{64}$/);
const instant = z.iso.datetime({ offset: true });
export const settingsSchema = z.object({
  enabled: activeSchema,
  auto_confirm: activeSchema,
  contact_email: z.union([z.literal(""), z.email()]),
  contact_phone: z.string().trim().max(40),
  address: z.string().trim().max(300),
  cancellation_policy: z
    .string()
    .trim()
    .min(10, "Describí la política de cancelación")
    .max(1500),
  cancellation_notice_minutes: z.coerce.number().int().min(0).max(43200),
  logo_url: httpsUrlSchema,
  cover_url: httpsUrlSchema,
  primary_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Usá un color como #355741"),
  secondary_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Usá un color como #eaf0e6"),
});
export const catalogSchema = z.object({
  organization: z.object({
    name: z.string(),
    slug: slugSchema,
    description: z.string(),
    timezone: z.string(),
  }),
  settings: z.object({
    contact_email: z.string(),
    contact_phone: z.string(),
    address: z.string(),
    cancellation_policy: z.string(),
    cancellation_notice_minutes: z.number(),
    logo_url: z.string().nullable(),
    cover_url: z.string().nullable(),
    primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    secondary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    auto_confirm: z.boolean(),
    updated_at: instant,
  }),
  services: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      description: z.string(),
      category: z.string(),
      duration_minutes: z.number(),
      preparation_minutes: z.number(),
      price_minor: z.number(),
      currency: z.string(),
      image_url: z.string().nullable(),
      updated_at: instant,
    }),
  ),
  professionals: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      description: z.string(),
      photo_url: z.string().nullable(),
      service_ids: z.array(z.uuid()),
    }),
  ),
  min_advance_minutes: z.number(),
  max_advance_days: z.number(),
});
export const receiptSchema = z.object({
  organization_name: z.string(),
  slug: slugSchema,
  timezone: z.string(),
  contact_email: z.string(),
  contact_phone: z.string(),
  customer_name: z.string(),
  service_name: z.string(),
  staff_name: z.string(),
  starts_at: instant,
  ends_at: instant,
  occupied_until: instant,
  duration_minutes: z.number(),
  preparation_minutes: z.number(),
  price_minor: z.number(),
  currency: z.string(),
  status: statusSchema,
  version: z.number().int().positive(),
  cancellation_policy: z.string(),
  cancellation_notice_minutes: z.number(),
  expires_at: instant,
  can_manage: z.boolean(),
});
export const slotsSchema = z.array(
  z.object({ starts_at: instant, ends_at: instant, occupied_until: instant }),
);
export const failureSchema = z.object({
  ok: z.literal(false),
  code: z.enum([
    "not_found",
    "rate_limited",
    "invalid",
    "unavailable",
    "stale",
    "policy",
  ]),
});
export const bookingInputSchema = z.object({
  request_key: z.uuid(),
  starts_at: instant,
  customer_name: z.string().trim().min(2, "Ingresá tu nombre").max(100),
  customer_email: z
    .string()
    .trim()
    .max(254)
    .pipe(z.email("Ingresá un email válido"))
    .transform((value) => value.toLowerCase()),
  customer_phone: z.string().trim().max(30),
  accept_policy: z.literal(true, {
    error: "Debés leer y aceptar la política de cancelación",
  }),
  website: z.string().max(0),
});
export type PublicCatalog = z.infer<typeof catalogSchema>;
export type PublicReceipt = z.infer<typeof receiptSchema>;
export type PublicActionState = {
  message?: string;
  errors?: Record<string, string[] | undefined>;
  receipt?: PublicReceipt;
  link?: string;
};
