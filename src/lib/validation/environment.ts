import { z } from "zod";

const optionalValue = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);
const httpUrl = z
  .url()
  .refine(
    (value) => ["http:", "https:"].includes(new URL(value).protocol),
    "Se requiere una URL HTTP o HTTPS",
  );

// Recibir únicamente las variables públicas; los secretos nunca entran a este esquema.
export const publicEnvironmentSchema = z
  .object({
    NEXT_PUBLIC_APP_URL: httpUrl.default("http://localhost:3000"),
    NEXT_PUBLIC_SUPABASE_URL: z.preprocess(
      (value) => (value === "" ? undefined : value),
      httpUrl.optional(),
    ),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalValue,
  })
  .superRefine((env, context) => {
    if (
      Boolean(env.NEXT_PUBLIC_SUPABASE_URL) !==
      Boolean(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
    ) {
      context.addIssue({
        code: "custom",
        message: "Configurar URL y clave pública de Supabase juntas",
        path: ["NEXT_PUBLIC_SUPABASE_URL"],
      });
    }
  });
