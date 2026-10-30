import { z } from "zod";
import { activeSchema } from "@/features/services/schema";
export const customerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  phone: z.string().trim().max(30),
  is_active: activeSchema,
});
export const preferencesSchema = z
  .object({
    transactional_email: activeSchema,
    marketing_consent: activeSchema,
    consent_evidence: z.string().trim().max(500),
  })
  .superRefine((v, ctx) => {
    if (v.marketing_consent && v.consent_evidence.length < 10)
      ctx.addIssue({
        code: "custom",
        path: ["consent_evidence"],
        message:
          "Registrá cómo y cuándo el cliente dio su consentimiento expreso",
      });
  });
export const directorySchema = z.object({
  q: z.string().trim().max(100).catch(""),
  activity: z.enum(["all", "active", "inactive"]).catch("active"),
  recurrence: z.enum(["all", "new", "visited", "recurrent"]).catch("all"),
  page: z.coerce.number().int().min(0).max(2000).catch(0),
});
