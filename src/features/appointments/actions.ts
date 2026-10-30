"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ActionState } from "@/types/actions";
import { requireOrganization } from "@/features/organizations/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { reportServerError } from "@/lib/errors";
import { catalogMutation, readFields } from "@/features/services/mutation";
import {
  createAppointmentSchema,
  bookingSettingsSchema,
  appointmentVersionSchema,
  statusSchema,
} from "./schema";

async function mutate<T>(
  org: string,
  schema: z.ZodType<T>,
  raw: unknown,
  execute: (
    client: SupabaseClient<Database>,
    input: T,
  ) => PromiseLike<{ data: unknown; error: { code?: string } | null }>,
  destination?: boolean,
): Promise<ActionState> {
  await requireOrganization(org);
  const input = schema.safeParse(raw);
  if (!input.success)
    return {
      message: "Revisá los campos indicados",
      errors: input.error.flatten().fieldErrors as Record<
        string,
        string[] | undefined
      >,
    };
  let result: unknown;
  try {
    const client = await createSupabaseServerClient(true);
    const { data, error } = await execute(client, input.data);
    if (error) {
      const messages: Record<string, string> = {
        P2002:
          "No pudimos acreditar fidelización porque se alcanzó su límite de saldo. El propietario debe revisar la tarjeta; el turno conserva su estado anterior.",
        P1001:
          "El acceso actual no permite crear o modificar turnos. Revisá Suscripción; podés cancelar reservas existentes.",
        "42501": "No tenés acceso a esa agenda. Actualizá la página.",
        "23P01":
          "El horario dejó de estar disponible. Elegí otro y volvé a intentar.",
        "40001":
          "La reserva cambió desde que abriste esta página. Actualizá antes de continuar.",
        "22023":
          "El cambio no es válido para este estado, recurso u horario. Completada requiere que el servicio haya terminado; ausente requiere que haya comenzado.",
        P0002: "La reserva ya no está disponible.",
      };
      if (messages[error.code ?? ""])
        return { message: messages[error.code ?? ""] };
      reportServerError("appointment.write_failed", error);
      return {
        message:
          "No pudimos guardar la reserva. Actualizá la página para verificar su estado.",
      };
    }
    result = data;
  } catch (error) {
    reportServerError("appointment.write_failed", error);
    return {
      message: "No pudimos conectar. Actualizá la página antes de reintentar.",
    };
  }
  revalidatePath(`/panel/${org}`, "layout");
  if (destination) {
    const id = z.uuid().safeParse(result);
    if (id.success) redirect(`/panel/${org}/reservas/${id.data}`);
    return { message: "Revisá el calendario para verificar la reserva." };
  }
  return { success: true, message: "Reserva actualizada" };
}
export async function createAppointmentAction(
  org: string,
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  return mutate(
    org,
    createAppointmentSchema,
    readFields(form, [
      "service_id",
      "staff_id",
      "starts_at",
      "customer_name",
      "customer_email",
      "customer_phone",
      "status",
      "request_key",
    ]),
    (client, input) =>
      client.rpc("create_appointment", {
        p_organization_id: org,
        p_service_id: input.service_id,
        p_staff_id: input.staff_id,
        p_starts_at: input.starts_at,
        p_customer_name: input.customer_name,
        p_customer_email: input.customer_email,
        p_customer_phone: input.customer_phone,
        p_status: input.status,
        p_request_key: input.request_key,
      }),
    true,
  );
}
export async function changeStatusAction(
  org: string,
  id: string,
  version: number,
  status: string,
  _previous: ActionState,
  _form: FormData,
): Promise<ActionState> {
  void _form;
  return mutate(
    org,
    appointmentVersionSchema.extend({ status: statusSchema }),
    { id, version, status },
    (client, input) =>
      client.rpc("change_appointment_status", {
        p_organization_id: org,
        p_id: input.id,
        p_version: input.version,
        p_status: input.status,
      }),
  );
}
export async function rescheduleAction(
  org: string,
  id: string,
  version: number,
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  return mutate(
    org,
    appointmentVersionSchema.extend({
      starts_at: z.iso.datetime({ offset: true }),
    }),
    { id, version, starts_at: form.get("starts_at") },
    (client, input) =>
      client.rpc("reschedule_appointment", {
        p_organization_id: org,
        p_id: input.id,
        p_version: input.version,
        p_starts_at: input.starts_at,
      }),
  );
}
export async function saveBookingSettingsAction(
  org: string,
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  return catalogMutation(
    org,
    "booking_settings.save_failed",
    bookingSettingsSchema,
    readFields(form, ["min_advance_minutes", "max_advance_days"]),
    (client, input) =>
      client.rpc("save_booking_settings", {
        p_organization_id: org,
        p_min_advance_minutes: input.min_advance_minutes,
        p_max_advance_days: input.max_advance_days,
      }),
  );
}
