import { z } from "zod";
import { currencyDigits, parseMoney } from "@/lib/utils/money";

export const idsSchema = z
  .array(z.uuid())
  .max(200)
  .transform((values) => [...new Set(values)]);
export const httpsUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    if (!value) return true;
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }, "Usá una URL HTTPS válida o dejá el campo vacío");
export const activeSchema = z
  .enum(["true", "false"])
  .transform((value) => value === "true");
export const serviceSchema = z
  .object({
    name: z.string().trim().min(2, "Usá al menos 2 caracteres").max(100),
    description: z.string().trim().max(2000),
    category: z.string().trim().max(100),
    duration_minutes: z.coerce
      .number()
      .int()
      .min(5, "Mínimo 5 minutos")
      .max(480),
    preparation_minutes: z.coerce.number().int().min(0).max(120),
    price: z.string().max(20),
    currency: z
      .string()
      .refine(
        (value) => currencyDigits(value) !== null,
        "Elegí un código de moneda válido",
      ),
    image_url: httpsUrlSchema,
    is_active: activeSchema,
    staff_ids: idsSchema,
  })
  .superRefine((value, ctx) => {
    if (parseMoney(value.price, value.currency) === null)
      ctx.addIssue({
        code: "custom",
        path: ["price"],
        message:
          "Ingresá un importe válido, sin separadores de miles y con los decimales de esa moneda",
      });
  });
