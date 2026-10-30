import Link from "next/link";
import { z } from "zod";
import { OrganizationScreen } from "@/components/layout/organization-screen";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { loadAppointment, loadSlots } from "@/features/appointments/queries";
import {
  changeStatusAction,
  rescheduleAction,
} from "@/features/appointments/actions";
import {
  localDay,
  localTime,
  statusLabels,
  transitions,
} from "@/features/appointments/presentation";
import { formatMoney } from "@/lib/utils/money";
import { revokePublicLinkAction } from "@/features/public-booking/actions";

export const metadata = { title: "Detalle de reserva" };
export default async function AppointmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string; appointmentId: string }>;
  searchParams: Promise<{ fecha?: string | string[] }>;
}) {
  const { organizationId: org, appointmentId: id } = await params;
  const { context, item, history } = await loadAppointment(org, id);
  const zone = context.organization.timezone;
  const query = await searchParams;
  const canReschedule =
    ["pending", "confirmed"].includes(item.status) &&
    new Date(item.starts_at) > new Date();
  const day = z.iso.date().safeParse(query.fecha).success
    ? String(query.fecha)
    : localDay(zone, new Date(item.starts_at));
  const result = canReschedule
    ? await loadSlots(org, item.service_id, item.staff_id, day, item.id)
    : { slots: [] };
  return (
    <OrganizationScreen organizationId={org}>
      <Link
        href={`/panel/${org}/calendario?fecha=${localDay(zone, new Date(item.starts_at))}`}
        className="text-primary mb-5 inline-flex min-h-11 items-center text-sm underline"
      >
        ← Volver al calendario
      </Link>
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <section className="space-y-5 rounded-2xl border bg-white p-6 md:p-8">
          {item.source === "public" && (
            <p className="text-primary text-xs font-medium tracking-wider uppercase">
              Reserva online · sin cuenta
            </p>
          )}
          <h1 className="text-2xl font-semibold break-words">
            {item.service_name}
          </h1>
          <p className="text-sm">
            {statusLabels[item.status]} · {item.staff_name}
          </p>
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Fecha y hora · {zone}</dt>
              <dd className="mt-1">
                {localDay(zone, new Date(item.starts_at))} ·{" "}
                {localTime(item.starts_at, zone)} →{" "}
                {localTime(item.ends_at, zone)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                Tiempo ocupado, incluida preparación
              </dt>
              <dd className="mt-1">
                {item.duration_minutes} + {item.preparation_minutes} minutos ·
                hasta {localTime(item.occupied_until, zone)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Valor acordado</dt>
              <dd className="mt-1">
                {formatMoney(item.price_minor, item.currency)} {item.currency} ·
                No indica pago registrado
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Cliente</dt>
              <dd className="mt-1 space-y-1 break-words">
                <p>{item.customer_name}</p>
                {item.customer_id && (
                  <Link
                    href={`/panel/${org}/clientes/${item.customer_id}`}
                    className="text-primary inline-flex min-h-11 items-center underline"
                  >
                    Ver ficha e historial del cliente
                  </Link>
                )}
                <p>{item.customer_email}</p>
                {item.customer_phone && <p>{item.customer_phone}</p>}
              </dd>
            </div>
          </dl>
          <p className="text-muted-foreground text-xs leading-5">
            El precio, la duración y los nombres se guardaron al reservar.
            Cambiar el catálogo no altera estas condiciones. Zona registrada:{" "}
            {item.timezone}.
          </p>
          <div className="space-y-3 border-t pt-5">
            <h2 className="font-semibold">Cambiar estado</h2>
            {transitions[item.status].length ? (
              <>
                <p className="text-muted-foreground text-xs leading-5">
                  Completada: después del fin del servicio. Ausente: después del
                  inicio. Cancelar conserva el historial y libera el horario.
                </p>
                {transitions[item.status].map((status) => (
                  <ActionForm
                    key={`${item.version}-${status}`}
                    requiresModule={status === "canceled" ? false : "bookings"}
                    action={changeStatusAction.bind(
                      null,
                      org,
                      id,
                      item.version,
                      status,
                    )}
                    fields={[]}
                    submitLabel={
                      status === "canceled"
                        ? "Cancelar reserva"
                        : `Marcar ${statusLabels[status].toLowerCase()}`
                    }
                  />
                ))}
              </>
            ) : (
              <p className="text-muted-foreground text-sm">
                Estado final; no admite cambios.
              </p>
            )}
          </div>
        </section>
        <div className="space-y-6">
          {item.source === "public" && context.role === "owner" && (
            <section className="space-y-4 rounded-2xl border bg-white p-6">
              <h2 className="font-semibold">Enlace de gestión del cliente</h2>
              <p className="text-muted-foreground text-sm leading-6">
                Podés revocar el enlace si fue compartido por error. El turno se
                conserva y el equipo puede seguir gestionándolo desde este
                panel.
              </p>
              <ActionForm
                action={revokePublicLinkAction.bind(null, org, id)}
                requiresModule={false}
                fields={[]}
                submitLabel="Revocar enlace del cliente"
              />
            </section>
          )}
          {canReschedule && (
            <section className="space-y-4 rounded-2xl border bg-white p-6">
              <h2 className="text-lg font-semibold">Reprogramar</h2>
              <p className="text-muted-foreground text-sm leading-6">
                Se conserva el servicio, profesional, precio y duración
                originales. Los horarios y bloqueos actuales se vuelven a
                comprobar.
              </p>
              <form className="flex flex-wrap items-end gap-3">
                <div>
                  <label
                    htmlFor="reschedule-date"
                    className="mb-2 block text-sm"
                  >
                    Nueva fecha
                  </label>
                  <input
                    id="reschedule-date"
                    name="fecha"
                    type="date"
                    required
                    defaultValue={day}
                    className="min-h-11 min-w-0 rounded-md border px-3 text-base"
                  />
                </div>
                <Button type="submit" variant="outline" className="min-h-11">
                  Consultar
                </Button>
              </form>
              {result.slots.length ? (
                <ActionForm
                  key={`${item.version}-${day}`}
                  action={rescheduleAction.bind(null, org, id, item.version)}
                  fields={[
                    {
                      name: "starts_at",
                      label: `Nuevo horario · ${day}`,
                      type: "select",
                      required: true,
                      value: result.slots[0]!.starts_at,
                      options: result.slots.map((slot) => ({
                        value: slot.starts_at,
                        label: localTime(slot.starts_at, zone),
                      })),
                    },
                  ]}
                  submitLabel="Guardar reprogramación"
                />
              ) : (
                <p role="status" className="text-muted-foreground text-sm">
                  {result.message ??
                    "No hay horarios disponibles para esa fecha."}
                </p>
              )}
            </section>
          )}
          <section className="space-y-4 rounded-2xl border bg-white p-6">
            <h2 className="text-lg font-semibold">Historial</h2>
            <ol className="space-y-4">
              {history.map((entry) => (
                <li key={entry.id} className="border-t pt-3 text-sm leading-6">
                  <p>
                    {entry.event === "created"
                      ? "Creada"
                      : entry.event === "rescheduled"
                        ? "Reprogramada"
                        : "Estado actualizado"}{" "}
                    · {statusLabels[entry.to_status]}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {new Intl.DateTimeFormat("es-AR", {
                      timeZone: zone,
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(new Date(entry.created_at))}
                  </p>
                  {entry.event === "rescheduled" && (
                    <p className="text-xs">
                      {entry.old_starts_at &&
                        `${localDay(zone, new Date(entry.old_starts_at))} ${localTime(entry.old_starts_at, zone)} → `}
                      {localDay(zone, new Date(entry.new_starts_at))}{" "}
                      {localTime(entry.new_starts_at, zone)}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </OrganizationScreen>
  );
}
