import { z } from "zod";
import {
  activeSchema,
  httpsUrlSchema,
  idsSchema,
} from "@/features/services/schema";

export const professionalSchema = z.object({
  name: z.string().trim().min(2, "Usá al menos 2 caracteres").max(100),
  description: z.string().trim().max(2000),
  photo_url: httpsUrlSchema,
  user_id: z.union([z.uuid(), z.literal("")]),
  is_active: activeSchema,
  service_ids: idsSchema,
});
export const invitationSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Ingresá un email válido").max(254)),
});
export const invitationTokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
