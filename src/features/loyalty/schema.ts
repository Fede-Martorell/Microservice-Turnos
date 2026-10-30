import { z } from "zod";
export const modeSchema = z.enum(["visits", "points"]);
const period = { starts_on: z.iso.date(), ends_on: z.iso.date() };
const validPeriod = (v: { starts_on: string; ends_on: string }) =>
  v.ends_on >= v.starts_on &&
  new Date(v.ends_on).getTime() - new Date(v.starts_on).getTime() <=
    3650 * 86400000;
export const programSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    mode: modeSchema,
    is_active: z.boolean(),
    ...period,
    conditions: z.string().trim().min(5).max(2000),
    expire_days: z.union([
      z.literal(""),
      z.coerce.number().int().min(1).max(3650),
    ]),
    reset_mode: z.enum(["subtract", "reset"]),
    services: z
      .record(z.uuid(), z.number().int().min(1).max(10000))
      .refine(
        (v) => Object.keys(v).length >= 1 && Object.keys(v).length <= 200,
        "Elegí entre 1 y 200 servicios",
      ),
  })
  .superRefine((v, c) => {
    if (!validPeriod(v))
      c.addIssue({
        code: "custom",
        path: ["ends_on"],
        message: "Período inválido (máximo 3651 días)",
      });
    if (v.mode === "points" && v.reset_mode !== "subtract")
      c.addIssue({
        code: "custom",
        path: ["reset_mode"],
        message: "Los puntos se descuentan según el costo de la recompensa",
      });
    if (v.mode === "visits" && Object.values(v.services).some((n) => n !== 1))
      c.addIssue({
        code: "custom",
        path: ["services"],
        message: "Una visita por reserva completada",
      });
  });
const optionalInt = (maximum: number) =>
  z.union([z.literal(""), z.coerce.number().int().min(1).max(maximum)]);
export const rewardInputSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    benefit: z.string().trim().min(5).max(2000),
    cost: z.coerce.number().int().min(1).max(1000000),
    conditions: z.string().trim().max(2000),
    ...period,
    per_customer_limit: optionalInt(10000),
    total_limit: optionalInt(1000000),
    is_active: z.boolean(),
  })
  .refine(validPeriod, {
    path: ["ends_on"],
    message: "Período inválido (máximo 3651 días)",
  });
export const reasonSchema = z.string().trim().min(5).max(300);
export const adjustmentSchema = z.object({
  amount: z.coerce
    .number()
    .int()
    .min(-1000000)
    .max(1000000)
    .refine((n) => n !== 0, "El ajuste debe ser distinto de cero"),
  reason: reasonSchema,
  reference: z.union([z.literal(""), z.uuid()]),
  request_key: z.uuid(),
});
export const programRowSchema = z.object({
  id: z.uuid(),
  organization_id: z.uuid(),
  name: z.string(),
  mode: modeSchema,
  is_active: z.boolean(),
  version: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});
export const ruleRowSchema = z.object({
  id: z.uuid(),
  program_id: z.uuid(),
  organization_id: z.uuid(),
  version: z.number(),
  starts_at: z.string(),
  ends_at: z.string(),
  conditions: z.string(),
  expire_days: z.number().nullable(),
  reset_mode: z.enum(["subtract", "reset"]),
  created_by: z.uuid(),
  created_at: z.string(),
});
export const rewardRowSchema = z.object({
  id: z.uuid(),
  organization_id: z.uuid(),
  program_id: z.uuid(),
  name: z.string(),
  benefit: z.string(),
  cost: z.number(),
  conditions: z.string(),
  starts_at: z.string(),
  ends_at: z.string(),
  per_customer_limit: z.number().nullable(),
  total_limit: z.number().nullable(),
  is_active: z.boolean(),
  version: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});
export const configSchema = z.object({
  program: programRowSchema.nullable(),
  rule: ruleRowSchema.nullable(),
  services: z.array(
    z.object({
      organization_id: z.uuid(),
      rule_id: z.uuid(),
      service_id: z.uuid(),
      points: z.number(),
    }),
  ),
  rewards: z.array(rewardRowSchema),
  mode_locked: z.boolean(),
});
export const transactionSchema = z.object({
  id: z.uuid(),
  organization_id: z.uuid(),
  account_id: z.uuid(),
  kind: z.enum(["earned", "adjustment", "redeemed", "refund"]),
  amount: z.number(),
  expires_at: z.string().nullable(),
  appointment_id: z.uuid().nullable(),
  rule_id: z.uuid().nullable(),
  related_transaction_id: z.uuid().nullable(),
  reason: z.string(),
  service_name: z.string(),
  created_by: z.uuid().nullable(),
  created_at: z.string(),
  rule_version: z.number().nullable(),
});
export const rewardSnapshotSchema = z.object({
  name: z.string(),
  benefit: z.string(),
  cost: z.number(),
  conditions: z.string(),
  version: z.number(),
  mode: modeSchema,
  reset_mode: z.enum(["subtract", "reset"]),
  consumed: z.number(),
});
export const expirySchema = z.object({
  next_expiry: z.string().nullable(),
  expired_balance: z.number(),
});
export const customerLoyaltySchema = z.object({
  account_id: z.uuid().nullable(),
  balance: z.number(),
  expiry: expirySchema,
  can_redeem: z.boolean(),
  available_rewards: z.array(z.uuid()),
  card: z.object({ expires_at: z.string(), revoked: z.boolean() }).nullable(),
  transactions: z.array(transactionSchema),
  redemptions: z.array(
    z.object({
      id: z.uuid(),
      organization_id: z.uuid(),
      account_id: z.uuid(),
      reward_id: z.uuid(),
      transaction_id: z.uuid(),
      reward_snapshot: rewardSnapshotSchema,
      created_by: z.uuid(),
      created_at: z.string(),
      voided: z.boolean(),
    }),
  ),
});
export const cardSchema = z.object({
  organization_name: z.string(),
  timezone: z.string(),
  program_name: z.string(),
  mode: modeSchema,
  balance: z.number(),
  expiry: expirySchema,
  operational: z.boolean(),
  conditions: z.string(),
  reset_mode: z.enum(["subtract", "reset"]),
  expire_days: z.number().nullable(),
  expires_at: z.string(),
  rewards: z.array(
    z.object({
      name: z.string(),
      benefit: z.string(),
      cost: z.number(),
      conditions: z.string(),
      starts_at: z.string(),
      ends_at: z.string(),
      available: z.boolean(),
    }),
  ),
  history: z.array(
    z.object({
      kind: z.enum(["earned", "adjustment", "redeemed", "refund"]),
      amount: z.number(),
      expires_at: z.string().nullable(),
      created_at: z.string(),
      service_name: z.string(),
    }),
  ),
});
export type LoyaltyConfig = z.infer<typeof configSchema>;
export type LoyaltyReward = z.infer<typeof rewardRowSchema>;
export type LoyaltyCard = z.infer<typeof cardSchema>;
export const cardCookie = "loyalty_card_access";
