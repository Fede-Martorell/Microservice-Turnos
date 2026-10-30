import { z } from "zod";

export const reservedSlugs = [
  "admin",
  "api",
  "auth",
  "b",
  "ingresar",
  "panel",
  "proyecto",
  "registro",
  "www",
] as const;
export const organizationIdSchema = z.uuid();
export const organizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Ingresá al menos 2 caracteres")
    .max(100, "Usá hasta 100 caracteres"),
  slug: z
    .string()
    .trim()
    .min(3, "Usá entre 3 y 63 caracteres")
    .max(63, "Usá hasta 63 caracteres")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Usá minúsculas, números y guiones entre palabras",
    )
    .refine(
      (value) => !(reservedSlugs as readonly string[]).includes(value),
      "Ese identificador está reservado",
    ),
  description: z.string().trim().max(2000, "Usá hasta 2000 caracteres"),
  timezone: z
    .string()
    .max(100)
    .refine((value) => {
      try {
        new Intl.DateTimeFormat("es", { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, "Elegí una zona horaria válida"),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/, "Usá un código de moneda de 3 letras"),
});

export type OrganizationInput = z.infer<typeof organizationSchema>;
