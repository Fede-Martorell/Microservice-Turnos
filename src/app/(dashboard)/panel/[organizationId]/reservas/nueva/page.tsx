import { loadCatalog } from "@/features/services/queries";
import { loadSlots } from "@/features/appointments/queries";
import { createAppointmentAction } from "@/features/appointments/actions";
import { localDay, localTime } from "@/features/appointments/presentation";
import { OrganizationScreen } from "@/components/layout/organization-screen";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { z } from "zod";
import { formatMoney } from "@/lib/utils/money";

export const metadata = { title: "Nueva reserva" };
export default async function NewAppointmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { organizationId: org } = await params;
  const query = await searchParams;
  const data = await loadCatalog(org);
  const zone = data.context.organization.timezone;
  const services = data.services.filter((item) => item.is_active);
  const service = query.servicio
    ? services.find((item) => item.id === query.servicio)
    : services[0];
  const professionals = data.professionals.filter(
    (profile) =>
      profile.is_active &&
      data.assignments.some(
        (assignment) =>
          assignment.staff_id === profile.id &&
          assignment.service_id === service?.id,
      ),
  );
  const profile = query.profesional
    ? professionals.find((item) => item.id === query.profesional)
    : professionals[0];
  const day = z.iso.date().safeParse(query.fecha).success
    ? String(query.fecha)
    : localDay(zone);
  const result =
    service && profile
      ? await loadSlots(org, service.id, profile.id, day)
      : {
          slots: [],
          message:
            "Elegí un servicio activo y un profesional que lo ofrezca. Ambos deben estar activos y tener horarios configurados para poder reservar.",
        };
  return (
    <OrganizationScreen organizationId={org}>
      <h1 className="mb-3 text-3xl font-semibold">Nueva reserva</h1>
      <p className="text-muted-foreground mb-6 max-w-2xl text-sm leading-6">
        Seleccioná el servicio, un profesional y la fecha. Horarios en {zone},
        cada 15 minutos; incluyen la preparación. Al guardar se vuelve a
        comprobar la disponibilidad.
      </p>
      <form className="mb-6 grid items-end gap-4 rounded-2xl border bg-white p-6 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <label htmlFor="service" className="mb-2 block text-sm font-medium">
            Servicio
          </label>
          <select
            id="service"
            name="servicio"
            defaultValue={service?.id ?? ""}
            className="min-h-11 w-full rounded-md border px-3"
          >
            {services.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="professional"
            className="mb-2 block text-sm font-medium"
          >
            Profesional
          </label>
          <select
            id="professional"
            name="profesional"
            defaultValue={profile?.id ?? ""}
            className="min-h-11 w-full rounded-md border px-3"
          >
            {data.professionals
              .filter((item) => item.is_active)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label htmlFor="day" className="mb-2 block text-sm font-medium">
            Fecha
          </label>
          <input
            id="day"
            name="fecha"
            type="date"
            required
            defaultValue={day}
            className="min-h-11 w-full min-w-0 rounded-md border px-3 text-base"
          />
        </div>
        <Button type="submit" className="min-h-11">
          Consultar horarios
        </Button>
      </form>
      {result.slots.length > 0 && service && profile ? (
        <section className="max-w-2xl rounded-2xl border bg-white p-6 md:p-8">
          <h2 className="mb-3 text-xl font-semibold break-words">
            {service.name} · {profile.name}
          </h2>
          <p className="text-muted-foreground mb-6 text-sm">
            {day} · {service.duration_minutes} min +{" "}
            {service.preparation_minutes} min de preparación ·{" "}
            {formatMoney(service.price_minor, service.currency)}{" "}
            {service.currency}
          </p>
          <ActionForm
            key={`${service.id}-${profile.id}-${day}`}
            action={createAppointmentAction.bind(null, org)}
            fields={[
              {
                name: "service_id",
                label: "",
                type: "hidden",
                value: service.id,
              },
              {
                name: "staff_id",
                label: "",
                type: "hidden",
                value: profile.id,
              },
              {
                name: "request_key",
                label: "",
                type: "hidden",
                value: crypto.randomUUID(),
              },
              {
                name: "starts_at",
                label: "Horario disponible",
                type: "select",
                required: true,
                value: result.slots[0]!.starts_at,
                options: result.slots.map((slot) => ({
                  value: slot.starts_at,
                  label: localTime(slot.starts_at, zone),
                })),
              },
              {
                name: "customer_name",
                label: "Nombre del cliente",
                required: true,
                maxLength: 100,
              },
              {
                name: "customer_email",
                label: "Email del cliente",
                type: "email",
                required: true,
                maxLength: 254,
              },
              {
                name: "customer_phone",
                label: "Teléfono (opcional)",
                maxLength: 30,
              },
              {
                name: "status",
                label: "Estado inicial",
                type: "select",
                value: "confirmed",
                options: [
                  { value: "confirmed", label: "Confirmada" },
                  { value: "pending", label: "Pendiente" },
                ],
                hint: "Ambos estados ocupan el horario. No se envían emails ni se registra un pago.",
              },
            ]}
            submitLabel="Crear reserva"
          />
        </section>
      ) : (
        <p
          role="status"
          className="rounded-xl border bg-white p-6 text-sm leading-6"
        >
          {result.message ??
            "No hay horarios disponibles. Revisá la fecha, la anticipación permitida, los horarios del negocio/profesional, descansos y bloqueos."}
        </p>
      )}
    </OrganizationScreen>
  );
}
