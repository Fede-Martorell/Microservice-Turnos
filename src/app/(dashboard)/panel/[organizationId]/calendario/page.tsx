import Link from "next/link";
import { z } from "zod";
import { OrganizationScreen } from "@/components/layout/organization-screen";
import { Button } from "@/components/ui/button";
import { loadCalendar } from "@/features/appointments/queries";
import { requireOrganization } from "@/features/organizations/queries";
import {
  addDays,
  localDay,
  localTime,
  statusLabels,
} from "@/features/appointments/presentation";
import { statusSchema } from "@/features/appointments/schema";

export const metadata = { title: "Calendario" };
export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { organizationId: org } = await params;
  const context = await requireOrganization(org);
  const zone = context.organization.timezone;
  const query = await searchParams;
  const day = z.iso.date().safeParse(query.fecha).success
    ? String(query.fecha)
    : localDay(zone);
  const days = query.vista === "semana" ? 7 : 1;
  const { items } = await loadCalendar(org, day, days);
  const status = statusSchema.safeParse(query.estado);
  const professional = z.uuid().safeParse(query.profesional);
  const filtered = items.filter(
    (item) =>
      (!status.success || item.status === status.data) &&
      (!professional.success || item.staff_id === professional.data),
  );
  const profiles = [
    ...new Map(items.map((item) => [item.staff_id, item.staff_name])).entries(),
  ];
  const href = (date: string) =>
    `/panel/${org}/calendario?${new URLSearchParams({ fecha: date, vista: days === 7 ? "semana" : "dia", ...(status.success ? { estado: status.data } : {}), ...(professional.success ? { profesional: professional.data } : {}) })}`;
  return (
    <OrganizationScreen organizationId={org}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Calendario</h1>
          <p className="text-muted-foreground mt-3 text-sm">
            Zona del negocio: {zone}.{" "}
            {context.role === "staff"
              ? "Solo tu agenda autorizada."
              : "Reservas de todos los profesionales del negocio."}
          </p>
        </div>
        <Button asChild className="min-h-11">
          <Link href={`/panel/${org}/reservas/nueva`}>Nueva reserva</Link>
        </Button>
      </div>
      <form className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border bg-white p-5">
        <div>
          <label htmlFor="date" className="mb-2 block text-sm">
            Fecha inicial
          </label>
          <input
            id="date"
            name="fecha"
            type="date"
            required
            defaultValue={day}
            className="min-h-11 min-w-0 rounded-md border px-3 text-base"
          />
        </div>
        <div>
          <label htmlFor="view" className="mb-2 block text-sm">
            Vista
          </label>
          <select
            id="view"
            name="vista"
            defaultValue={days === 7 ? "semana" : "dia"}
            className="min-h-11 rounded-md border px-3"
          >
            <option value="dia">Diaria</option>
            <option value="semana">7 días</option>
          </select>
        </div>
        <div>
          <label htmlFor="status" className="mb-2 block text-sm">
            Estado
          </label>
          <select
            id="status"
            name="estado"
            defaultValue={status.success ? status.data : ""}
            className="min-h-11 rounded-md border px-3"
          >
            <option value="">Todos</option>
            {Object.entries(statusLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="max-w-full">
          <label htmlFor="staff" className="mb-2 block text-sm">
            Profesional
          </label>
          <select
            id="staff"
            name="profesional"
            defaultValue={professional.success ? professional.data : ""}
            className="min-h-11 max-w-full rounded-md border px-3"
          >
            <option value="">Todos</option>
            {profiles.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="outline" className="min-h-11">
          Ver agenda
        </Button>
      </form>
      <nav
        aria-label="Fechas del calendario"
        className="text-primary mb-5 flex flex-wrap justify-between gap-3 text-sm underline"
      >
        <Link
          href={href(addDays(day, -days))}
          className="inline-flex min-h-11 items-center"
        >
          ← Anterior
        </Link>
        <Link
          href={href(localDay(zone))}
          className="inline-flex min-h-11 items-center"
        >
          Hoy
        </Link>
        <Link
          href={href(addDays(day, days))}
          className="inline-flex min-h-11 items-center"
        >
          Siguiente →
        </Link>
      </nav>
      <div
        className={
          days === 7
            ? "grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3"
            : "space-y-4"
        }
      >
        {Array.from({ length: days }, (_, index) => addDays(day, index)).map(
          (date) => {
            const entries = filtered.filter(
              (item) => localDay(zone, new Date(item.starts_at)) === date,
            );
            return (
              <section
                key={date}
                className="min-w-0 rounded-xl border bg-white p-5"
              >
                <h2 className="mb-4 font-semibold">
                  {new Intl.DateTimeFormat("es-AR", {
                    timeZone: "UTC",
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  }).format(new Date(`${date}T12:00:00Z`))}
                </h2>
                {entries.length ? (
                  <ol className="space-y-3">
                    {entries.map((item) => (
                      <li key={item.id}>
                        <Link
                          href={`/panel/${org}/reservas/${item.id}`}
                          className="hover:bg-muted block space-y-2 rounded-lg border p-4"
                        >
                          <p className="text-sm font-medium">
                            {localTime(item.starts_at, zone)} →{" "}
                            {localTime(item.ends_at, zone)}
                          </p>
                          <p className="text-sm break-words">
                            {item.service_name} · {item.staff_name}
                          </p>
                          <p className="text-muted-foreground text-sm break-words">
                            {item.customer_name}
                          </p>
                          <span className="bg-muted inline-block rounded px-2 py-1 text-xs">
                            {statusLabels[item.status]}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    No hay reservas para estos filtros.
                  </p>
                )}
              </section>
            );
          },
        )}
      </div>
    </OrganizationScreen>
  );
}
