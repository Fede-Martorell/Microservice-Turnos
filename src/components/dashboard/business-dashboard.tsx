import Link from "next/link";
import { ActivityChart } from "./activity-chart";
import type { BusinessDashboard as Data } from "@/features/dashboard/schema";
import { addDays, statusLabels } from "@/features/appointments/presentation";
import { formatTimestamp } from "@/features/subscriptions/presentation";
import { Button } from "@/components/ui/button";
import { CalendarDays, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
const number = (n: number) => n.toLocaleString("es-AR");
const date = (v: string) => v.split("-").reverse().join("/");
const box = "surface-panel p-5 md:p-6";
function Metric({
  label,
  value,
  note,
  primary = false,
}: {
  label: string;
  value: number;
  note?: string;
  primary?: boolean;
}) {
  return (
    <div className={cn(box, primary && "border-primary bg-primary text-white")}>
      <p
        className={cn(
          "text-xs font-medium",
          primary ? "text-white/80" : "text-muted-foreground",
        )}
      >
        {label}
      </p>
      <p className="mt-4 text-4xl font-medium tracking-tight tabular-nums">
        {number(value)}
      </p>
      {note && (
        <p
          className={cn(
            "mt-3 text-[11px] leading-5",
            primary ? "text-white/75" : "text-muted-foreground",
          )}
        >
          {note}
        </p>
      )}
    </div>
  );
}
export function BusinessDashboard({
  data,
  base,
  invalid = false,
}: {
  data: Data;
  base: string;
  invalid?: boolean;
}) {
  const { counts, customers, today_counts: today } = data;
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Tu negocio en actividad</p>
          <h1 className="page-title mt-3">Resumen del negocio</h1>
          <p className="text-muted-foreground mt-3 text-xs">
            Actualizado: {formatTimestamp(data.as_of, data.timezone)} ·{" "}
            {data.timezone}
          </p>
        </div>
        <Button asChild>
          <Link href={`${base}/calendario`}>
            <CalendarDays className="size-4" />
            Ver calendario
            <ArrowUpRight className="size-4" />
          </Link>
        </Button>
      </div>
      <Link
        href={`${base}/puesta-en-marcha`}
        className="surface-panel hover:border-primary/30 mb-7 flex items-center justify-between gap-4 p-4 text-sm transition-colors"
      >
        <span>
          <strong className="font-medium">
            Prepará tu negocio para recibir turnos
          </strong>
          <span className="text-muted-foreground mt-1 block text-xs">
            Revisá equipo, servicios y horarios en Puesta en marcha.
          </span>
        </span>
        <ArrowUpRight aria-hidden className="text-primary size-5 shrink-0" />
      </Link>
      <section aria-labelledby="today-title" className="mb-8">
        <h2 id="today-title" className="mb-4 text-sm font-semibold">
          Hoy · {date(data.today)}
        </h2>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Metric
            primary
            label="Turnos de hoy"
            value={today.total}
            note="Incluye todos los estados."
          />
          <Metric label="Pendientes de hoy" value={today.pending} />
          <Metric label="Confirmados de hoy" value={today.confirmed} />
          <Metric label="Completados de hoy" value={today.completed} />
        </div>
        <p className="text-muted-foreground mt-3 text-sm">
          Cancelados hoy: {number(today.canceled)} · Ausencias de hoy:{" "}
          {number(today.no_show)}.
        </p>
      </section>
      <section
        aria-labelledby="stats-title"
        id="estadisticas"
        className="scroll-mt-5"
      >
        <h2 id="stats-title" className="text-xl font-semibold">
          Estadísticas básicas
        </h2>
        <p className="text-muted-foreground mt-2 text-sm leading-6">
          Según la fecha de inicio del turno y su estado actual. Fechas
          inclusive en la zona del negocio. No representan ventas ni cobros.
        </p>
        <form
          action={base}
          className="surface-panel my-5 flex flex-wrap items-end gap-3 p-5"
        >
          <label className="grid min-w-0 gap-2 text-sm">
            Desde
            <input
              className="min-h-11 min-w-0 rounded-lg border px-3"
              name="desde"
              type="date"
              defaultValue={data.from}
              required
              min="2000-01-01"
              max="2100-12-31"
            />
          </label>
          <label className="grid min-w-0 gap-2 text-sm">
            Hasta
            <input
              className="min-h-11 min-w-0 rounded-lg border px-3"
              name="hasta"
              type="date"
              defaultValue={data.to}
              required
              min="2000-01-01"
              max="2100-12-31"
            />
          </label>
          <Button type="submit">Aplicar período</Button>
          <div className="flex flex-wrap gap-3 text-sm">
            {[7, 30, 90].map((days) => (
              <Link
                key={days}
                className={cn(
                  "hover:bg-muted rounded-lg border px-3 py-3 text-xs font-medium transition-colors",
                  data.from === addDays(data.today, 1 - days) &&
                    data.to === data.today
                    ? "border-primary/20 bg-sage text-primary"
                    : "text-muted-foreground border-transparent",
                )}
                href={`${base}?${new URLSearchParams({ desde: addDays(data.today, 1 - days), hasta: data.today })}`}
              >
                Últimos {days} días
              </Link>
            ))}
          </div>
        </form>
        {invalid && (
          <p
            role="alert"
            className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm"
          >
            Elegí un período válido de hasta 93 días. Se muestran los últimos 30
            días.
          </p>
        )}
        <p className="mb-4 text-sm">
          Período: {date(data.from)} al {date(data.to)} · Máximo 93 días.
        </p>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Metric
            label="Reservas del período"
            value={counts.total}
            note="Incluye pendientes, confirmadas, completadas, canceladas y ausencias."
          />
          <Metric label="Servicios completados" value={counts.completed} />
          <Metric
            label="Clientes atendidos"
            value={customers.attended}
            note="Clientes únicos con al menos un turno completado en el período."
          />
          <Metric
            label="Clientes recurrentes"
            value={customers.recurring}
            note="Clientes con dos o más turnos completados en este período."
          />
          <dl className="col-span-2 grid grid-cols-2 gap-4 rounded-xl border bg-white px-5 py-4 sm:grid-cols-4 xl:col-span-4">
            {[
              { label: "Reservas pendientes", value: counts.pending },
              { label: "Reservas confirmadas", value: counts.confirmed },
              { label: "Cancelaciones", value: counts.canceled },
              { label: "Ausencias", value: counts.no_show },
            ].map((item) => (
              <div key={item.label}>
                <dt className="text-muted-foreground text-[11px]">
                  {item.label}
                </dt>
                <dd className="mt-1 text-xl font-medium tabular-nums">
                  {number(item.value)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        {counts.total === 0 && (
          <p className="mt-4 rounded-xl border border-dashed p-5 text-sm">
            Todavía no hay reservas para este período. Elegí otras fechas o
            consultá el calendario.
          </p>
        )}
        <div className="mt-5 grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <section className={box} aria-labelledby="chart-title">
            <h3 id="chart-title" className="font-semibold">
              Reservas por día
            </h3>
            <p className="text-muted-foreground mt-2 text-xs leading-5">
              Completadas y canceladas son parte del total de reservas; las
              barras no se suman entre sí.
            </p>
            {counts.total > 0 ? (
              <ActivityChart series={data.series} />
            ) : (
              <p className="text-muted-foreground py-12 text-center text-sm">
                Sin actividad para graficar.
              </p>
            )}
            <details className="mt-4">
              <summary className="text-primary min-h-11 cursor-pointer border-t py-3 text-xs font-medium">
                Ver datos diarios en tabla
              </summary>
              <div className="max-h-80 overflow-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">
                    Reservas según el día del turno
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col" className="p-2">
                        Fecha
                      </th>
                      <th scope="col" className="p-2">
                        Total
                      </th>
                      <th scope="col" className="p-2">
                        Completadas
                      </th>
                      <th scope="col" className="p-2">
                        Canceladas
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.series.map((row) => (
                      <tr key={row.day} className="border-t">
                        <th
                          scope="row"
                          className="p-2 font-normal whitespace-nowrap"
                        >
                          {date(row.day)}
                        </th>
                        <td className="p-2">{number(row.total)}</td>
                        <td className="p-2">{number(row.completed)}</td>
                        <td className="p-2">{number(row.canceled)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </section>
          <section className={box} aria-labelledby="services-title">
            <h3 id="services-title" className="font-semibold">
              Servicios más solicitados
            </h3>
            <p className="text-muted-foreground mt-2 text-xs leading-5">
              Hasta cinco servicios por cantidad de reservas, incluidos todos
              los estados. Nombre actual del catálogo.
            </p>
            {data.services.length === 0 ? (
              <p className="mt-5 text-sm">
                Sin servicios reservados en el período.
              </p>
            ) : (
              <ol className="mt-5 space-y-5">
                {data.services.map((s) => (
                  <li key={s.service_id}>
                    <div className="flex justify-between gap-4 text-sm">
                      <span className="min-w-0 font-medium break-words">
                        {s.name}
                      </span>
                      <span className="shrink-0">
                        {number(s.total)}{" "}
                        {s.total === 1 ? "reserva" : "reservas"}
                      </span>
                    </div>
                    <meter
                      aria-label={`Reservas de ${s.name}`}
                      min={0}
                      max={data.services[0]!.total}
                      value={s.total}
                      className="service-meter"
                    />
                    <p className="text-muted-foreground mt-1 text-xs">
                      {number(s.completed)}{" "}
                      {s.completed === 1 ? "completada" : "completadas"}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </section>
      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <section className={box} aria-labelledby="upcoming-title">
          <h2 id="upcoming-title" className="text-xl font-semibold">
            Próximas reservas
          </h2>
          <p className="text-muted-foreground mt-2 text-xs leading-5">
            Hasta cinco turnos pendientes o confirmados en la agenda de hoy y
            los próximos seis días, desde ahora. No cambia con el período
            estadístico.
          </p>
          {data.upcoming.length === 0 ? (
            <p className="mt-5 text-sm">
              No hay próximas reservas en los siete días de agenda.
            </p>
          ) : (
            <ul className="mt-5 divide-y">
              {data.upcoming.map((a) => (
                <li key={a.id} className="py-4 text-sm">
                  <Link
                    className="text-primary decoration-primary/20 hover:decoration-primary font-medium underline underline-offset-4"
                    href={`${base}/reservas/${a.id}`}
                  >
                    {a.customer_name} · {a.service_name}
                  </Link>
                  <p className="mt-2 break-words">
                    {formatTimestamp(a.starts_at, data.timezone)} ·{" "}
                    {a.staff_name}
                  </p>
                  <p className="status-pill border-primary/15 bg-sage text-primary mt-3">
                    {statusLabels[a.status]}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className={box} aria-labelledby="activity-title">
          <h2 id="activity-title" className="text-xl font-semibold">
            Actividad reciente
          </h2>
          <p className="text-muted-foreground mt-2 text-xs leading-5">
            Últimos diez cambios de reservas del negocio, independiente del
            período estadístico.
          </p>
          {data.activity.length === 0 ? (
            <p className="mt-5 text-sm">
              Todavía no hay cambios de reservas registrados.
            </p>
          ) : (
            <ul className="mt-5 divide-y">
              {data.activity.map((a) => (
                <li key={a.id} className="py-4 text-sm">
                  <p className="font-medium">
                    {a.event === "created"
                      ? "Reserva creada"
                      : a.event === "rescheduled"
                        ? "Reserva reprogramada"
                        : `Estado: ${statusLabels[a.to_status]}`}
                  </p>
                  <Link
                    className="text-primary mt-1 block break-words underline"
                    href={`${base}/reservas/${a.appointment_id}`}
                  >
                    {a.customer_name} · {a.service_name}
                  </Link>
                  <p className="text-muted-foreground mt-2 text-xs">
                    {formatTimestamp(a.created_at, data.timezone)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
