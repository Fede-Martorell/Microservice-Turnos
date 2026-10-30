import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Ingresá un email válido").max(254)),
  password: z
    .string()
    .min(1, "Ingresá tu contraseña")
    .max(128, "Usá hasta 128 caracteres"),
});
export const registrationSchema = loginSchema.extend({
  password: z
    .string()
    .min(12, "Usá al menos 12 caracteres")
    .max(128, "Usá hasta 128 caracteres"),
});
