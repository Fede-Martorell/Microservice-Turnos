import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { z } from "zod";
import { publicGateway } from "@/lib/public-booking/gateway";
import { managementCookie } from "@/lib/public-booking/visitor";
import { reportServerError } from "@/lib/errors";
import {
  catalogSchema,
  receiptSchema,
  slotsSchema,
  failureSchema,
  slugSchema,
  tokenSchema,
} from "./schema";

export const publicMessages: Record<string, string> = {
  not_found: "El enlace no está disponible o venció.",
  rate_limited:
    "Alcanzaste el límite temporal de consultas. Volvé a intentar más tarde o comunicate con el negocio.",
  invalid: "No pudimos procesar esos datos. Revisá el formulario.",
  unavailable:
    "Ese horario dejó de estar disponible. Actualizá la lista y elegí otro.",
  stale:
    "La información cambió. Actualizá la página para revisar los datos antes de continuar.",
  policy:
    "Esta reserva ya no admite cambios online. Comunicate con el negocio.",
};
export function parsePublicResult<T>(
  data: unknown,
  error: unknown,
  schema: z.ZodType<T>,
  key: "catalog" | "receipt" | "slots" | "card",
): { value: T | null; code: string } {
  if (error) {
    reportServerError("public_booking.request_failed", error);
    return { value: null, code: "offline" };
  }
  const failure = failureSchema.safeParse(data);
  if (failure.success) return { value: null, code: failure.data.code };
  const parsed = z
    .object({ ok: z.literal(true), [key]: schema })
    .safeParse(data);
  if (!parsed.success) {
    reportServerError("public_booking.invalid_response", {});
    return { value: null, code: "offline" };
  }
  return { value: parsed.data[key] as T, code: "ok" };
}
export async function requestPublicResult<T>(
  operation: () => PromiseLike<{ data: unknown; error: unknown }>,
  schema: z.ZodType<T>,
  key: "catalog" | "receipt" | "slots" | "card",
) {
  try {
    const { data, error } = await operation();
    return parsePublicResult(data, error, schema, key);
  } catch (error) {
    return parsePublicResult(null, error, schema, key);
  }
}
export const loadPublicCatalog = cache(async (slug: string) => {
  if (!slugSchema.safeParse(slug).success)
    return { value: null, code: "not_found" };
  const gateway = await publicGateway();
  if (!gateway) return { value: null, code: "offline" };
  const { data, error } = await gateway.client.rpc(
    "get_public_booking_catalog",
    { p_slug: slug, p_visitor: gateway.visitor },
  );
  return parsePublicResult(data, error, catalogSchema, "catalog");
});
export async function loadPublicSlots(
  slug: string,
  serviceId: string,
  staffId: string | null,
  day: string,
) {
  if (!z.iso.date().safeParse(day).success)
    return { value: null, code: "invalid" };
  const gateway = await publicGateway();
  if (!gateway) return { value: null, code: "offline" };
  const { data, error } = await gateway.client.rpc("get_public_booking_slots", {
    p_slug: slug,
    p_service_id: serviceId,
    p_staff_id: staffId,
    p_day: day,
    p_visitor: gateway.visitor,
  });
  return parsePublicResult(data, error, slotsSchema, "slots");
}
export async function managementContext() {
  const token = tokenSchema.safeParse(
    (await cookies()).get(managementCookie)?.value,
  );
  if (!token.success) return null;
  const gateway = await publicGateway();
  return gateway ? { ...gateway, token: token.data } : null;
}
export async function loadPublicReceipt() {
  const context = await managementContext();
  if (!context) return { value: null, code: "not_found" };
  const { data, error } = await context.client.rpc("inspect_public_booking", {
    p_token: context.token,
    p_visitor: context.visitor,
  });
  return parsePublicResult(data, error, receiptSchema, "receipt");
}
export async function loadRescheduleSlots(day: string) {
  const context = await managementContext();
  if (!context || !z.iso.date().safeParse(day).success)
    return { value: null, code: "not_found" };
  const { data, error } = await context.client.rpc(
    "get_public_reschedule_slots",
    { p_token: context.token, p_visitor: context.visitor, p_day: day },
  );
  return parsePublicResult(data, error, slotsSchema, "slots");
}
