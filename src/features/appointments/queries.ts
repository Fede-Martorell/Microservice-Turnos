import "server-only";
import { z } from "zod";
import { notFound } from "next/navigation";
import { requireOrganization } from "@/features/organizations/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { reportServerError } from "@/lib/errors";
import type { Appointment, Slot } from "@/types/appointments";

export async function loadAppointment(org: string, id: string) {
  const context = await requireOrganization(org);
  if (!z.uuid().safeParse(id).success) notFound();
  const client = await createSupabaseServerClient();
  const [{ data: item, error }, { data: history, error: historyError }] =
    await Promise.all([
      client
        .from("appointments")
        .select("*")
        .eq("organization_id", org)
        .eq("id", id)
        .maybeSingle(),
      client
        .from("appointment_history")
        .select("*")
        .eq("organization_id", org)
        .eq("appointment_id", id)
        .order("created_at"),
    ]);
  if (error || historyError) {
    reportServerError("appointment.read_failed", error ?? historyError);
    throw new Error("No pudimos cargar la reserva");
  }
  if (!item) notFound();
  return { context, item, history: history ?? [] };
}
export async function loadSlots(
  org: string,
  serviceId: string,
  staffId: string,
  day: string,
  appointmentId: string | null = null,
): Promise<{ slots: Slot[]; message?: string }> {
  await requireOrganization(org);
  if (
    !z.uuid().safeParse(serviceId).success ||
    !z.uuid().safeParse(staffId).success ||
    !z.iso.date().safeParse(day).success
  )
    return {
      slots: [],
      message: "Elegí un servicio, profesional y fecha válidos.",
    };
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("get_available_slots", {
    p_organization_id: org,
    p_service_id: serviceId,
    p_staff_id: staffId,
    p_day: day,
    p_appointment_id: appointmentId,
  });
  if (error) {
    if (["22023", "42501"].includes(error.code))
      return {
        slots: [],
        message:
          "No hay disponibilidad para esta selección. Revisá el servicio, profesional, fecha y horarios configurados.",
      };
    reportServerError("slots.read_failed", error);
    throw new Error("No pudimos calcular los horarios disponibles");
  }
  return { slots: data ?? [] };
}
export async function loadCalendar(org: string, day: string, days: 1 | 7) {
  const context = await requireOrganization(org);
  const client = await createSupabaseServerClient();
  const items: Appointment[] = [];
  // PostgREST limita cada respuesta: se recorren páginas sin truncar la agenda.
  for (let from = 0; ; from += 500) {
    const { data, error } = await client
      .rpc("get_appointment_calendar", {
        p_organization_id: org,
        p_day: day,
        p_days: days,
      })
      .range(from, from + 499);
    if (error) {
      reportServerError("calendar.read_failed", error);
      throw new Error("No pudimos cargar el calendario");
    }
    items.push(...(data ?? []));
    if (!data || data.length < 500) break;
  }
  return { context, items };
}
export async function loadBookingSettings(org: string) {
  await requireOrganization(org);
  const client = await createSupabaseServerClient();
  const { data, error } = await client
    .from("booking_settings")
    .select("*")
    .eq("organization_id", org)
    .maybeSingle();
  if (error) {
    reportServerError("booking_settings.read_failed", error);
    throw new Error("No pudimos cargar la configuración de reservas");
  }
  return (
    data ?? {
      organization_id: org,
      min_advance_minutes: 60,
      max_advance_days: 90,
    }
  );
}
