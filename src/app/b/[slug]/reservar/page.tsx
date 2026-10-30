import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import {
  loadPublicCatalog,
  loadPublicSlots,
  publicMessages,
} from "@/features/public-booking/queries";
import {
  PublicShell,
  PublicUnavailable,
} from "@/components/public-booking/public-shell";
import { PublicBookingForm } from "@/components/public-booking/booking-form";
import { publicGateway } from "@/lib/public-booking/gateway";
import { localDay, addDays } from "@/features/appointments/presentation";
import { formatMoney } from "@/lib/utils/money";
import { Button } from "@/components/ui/button";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Elegí tu turno",
  robots: { index: false, follow: false },
};
export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const result = await loadPublicCatalog(slug);
  if (result.code === "not_found") notFound();
  if (!result.value) return <PublicUnavailable />;
  const catalog = result.value;
  const service = catalog.services.find((item) => item.id === query.servicio);
  if (!service) notFound();
  const professionals = catalog.professionals.filter((profile) =>
    profile.service_ids.includes(service.id),
  );
  const selected =
    typeof query.profesional === "string" && query.profesional
      ? query.profesional
      : null;
  if (selected && !professionals.some((profile) => profile.id === selected))
    notFound();
  const day = z.iso.date().safeParse(query.fecha).success
    ? String(query.fecha)
    : localDay(catalog.organization.timezone);
  const available = await loadPublicSlots(slug, service.id, selected, day);
  const gateway = await publicGateway();
  return (
    <PublicShell catalog={catalog}>
      <Link
        href={`/b/${slug}`}
        className="text-primary inline-flex min-h-11 items-center text-sm underline"
      >
        ← Cambiar servicio
      </Link>
      <div>
        <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wider uppercase">
          Elegí profesional y fecha
        </p>
        <h1 className="text-3xl font-semibold break-words">{service.name}</h1>
        <p className="text-muted-foreground mt-3 text-sm">
          {formatMoney(service.price_minor, service.currency)}{" "}
          {service.currency} · {service.duration_minutes} min ·{" "}
          {catalog.organization.timezone}
        </p>
      </div>
      <form className="grid items-end gap-4 rounded-2xl border bg-white p-6 sm:grid-cols-2 lg:grid-cols-3">
        <input type="hidden" name="servicio" value={service.id} />
        <div className="min-w-0">
          <label
            htmlFor="public-professional"
            className="mb-2 block text-sm font-medium"
          >
            Profesional
          </label>
          <select
            id="public-professional"
            name="profesional"
            defaultValue={selected ?? ""}
            className="min-h-12 w-full rounded-lg border px-3 text-base"
          >
            <option value="">Cualquiera disponible</option>
            {professionals.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <label
            htmlFor="public-date"
            className="mb-2 block text-sm font-medium"
          >
            Fecha
          </label>
          <input
            id="public-date"
            name="fecha"
            type="date"
            defaultValue={day}
            min={localDay(catalog.organization.timezone)}
            max={addDays(
              localDay(catalog.organization.timezone),
              catalog.max_advance_days,
            )}
            required
            className="min-h-12 w-full min-w-0 rounded-lg border px-3 text-base"
          />
        </div>
        <Button type="submit" variant="outline" className="min-h-12">
          Ver horarios
        </Button>
      </form>
      <p className="text-muted-foreground text-xs leading-6">
        La reserva debe hacerse entre {catalog.min_advance_minutes} minutos y{" "}
        {catalog.max_advance_days} días de anticipación. Si elegís cualquiera
        disponible, el negocio asignará un profesional al guardar.
      </p>
      {!gateway?.config.canCreate ? (
        <p role="status" className="rounded-xl border bg-white p-6 text-sm">
          Las reservas online no están disponibles en este momento. Comunicate
          con el negocio.
        </p>
      ) : available.value?.length ? (
        <PublicBookingForm
          key={`${service.id}-${selected}-${day}`}
          slug={slug}
          serviceId={service.id}
          staffId={selected}
          serviceVersion={service.updated_at}
          settingsVersion={catalog.settings.updated_at}
          slots={available.value}
          zone={catalog.organization.timezone}
          requestKey={crypto.randomUUID()}
          siteKey={gateway.config.siteKey}
          visitor={gateway.visitor}
          policy={catalog.settings.cancellation_policy}
        />
      ) : (
        <p
          role="status"
          className="rounded-xl border bg-white p-6 text-sm leading-6"
        >
          {available.code === "ok"
            ? "No hay horarios disponibles para esta fecha. Probá otro día o elegí otro profesional."
            : (publicMessages[available.code] ??
              "No pudimos consultar la disponibilidad. Volvé a intentar.")}
        </p>
      )}
    </PublicShell>
  );
}
