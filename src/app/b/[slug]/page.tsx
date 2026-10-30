import Link from "next/link";
import { notFound } from "next/navigation";
import {
  loadPublicCatalog,
  publicMessages,
} from "@/features/public-booking/queries";
import {
  PublicShell,
  PublicUnavailable,
} from "@/components/public-booking/public-shell";
import { formatMoney } from "@/lib/utils/money";
import { getEnvironment } from "@/lib/config/environment.server";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await loadPublicCatalog(slug);
  return result.value
    ? {
        title: `Reservar · ${result.value.organization.name}`,
        description: result.value.organization.description.slice(0, 160),
        alternates: {
          canonical: new URL(
            `/b/${slug}`,
            getEnvironment()?.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
          ).toString(),
        },
      }
    : { title: "Reservas", robots: { index: false, follow: false } };
}
export default async function BusinessPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await loadPublicCatalog(slug);
  if (result.code === "not_found") notFound();
  if (!result.value)
    return <PublicUnavailable message={publicMessages[result.code]} />;
  const catalog = result.value;
  return (
    <PublicShell catalog={catalog}>
      <section className="overflow-hidden rounded-3xl border bg-white">
        {catalog.settings.cover_url && (
          <div className="h-44 overflow-hidden md:h-64">
            <PublicImage
              src={catalog.settings.cover_url}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        )}
        <div className="space-y-4 bg-[var(--public-secondary)] p-6 text-[var(--public-secondary-text)] md:p-10">
          {catalog.settings.logo_url && (
            <PublicImage
              src={catalog.settings.logo_url}
              alt=""
              className="size-16 rounded-xl object-cover"
            />
          )}
          <p className="text-xs font-medium tracking-wider uppercase">
            Tu próximo turno
          </p>
          <h1 className="editorial-title text-4xl break-words md:text-6xl">
            {catalog.organization.name}
          </h1>
          {catalog.organization.description && (
            <p className="max-w-2xl text-sm leading-7 break-words whitespace-pre-wrap">
              {catalog.organization.description}
            </p>
          )}
          <p className="text-xs">Horarios en {catalog.organization.timezone}</p>
        </div>
      </section>
      <section>
        <h2 className="mb-5 text-xl font-semibold">Elegí un servicio</h2>
        <div className="grid gap-5 md:grid-cols-2">
          {catalog.services.map((service) => (
            <article
              key={service.id}
              className="surface-link flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-white"
            >
              {service.image_url && (
                <PublicImage
                  src={service.image_url}
                  alt=""
                  className="h-40 w-full object-cover"
                />
              )}
              <div className="flex flex-1 flex-col gap-3 p-6">
                <p className="text-muted-foreground text-xs break-words">
                  {service.category || "Servicio"}
                </p>
                <h3 className="text-xl font-semibold break-words">
                  {service.name}
                </h3>
                <p className="text-muted-foreground text-sm leading-6 break-words whitespace-pre-wrap">
                  {service.description}
                </p>
                <p className="mt-auto pt-3 text-lg font-semibold tracking-tight">
                  {formatMoney(service.price_minor, service.currency)}{" "}
                  {service.currency} · {service.duration_minutes} min
                </p>
                <Link
                  href={`/b/${slug}/reservar?servicio=${service.id}`}
                  className="mt-2 inline-flex min-h-12 items-center justify-center rounded-lg bg-[var(--public-primary)] px-5 text-sm font-medium text-[var(--public-primary-text)] hover:opacity-90"
                >
                  Elegir {service.name}
                </Link>
              </div>
            </article>
          ))}
        </div>
        {!catalog.services.length && (
          <p className="text-muted-foreground rounded-xl border bg-white p-6 text-sm">
            Todavía no hay servicios disponibles para reservar online.
          </p>
        )}
      </section>
      <section className="rounded-2xl border bg-white p-6">
        <h2 className="font-semibold">Profesionales</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          {catalog.professionals.map((profile) => (
            <div key={profile.id} className="flex min-w-0 items-start gap-4">
              {profile.photo_url && (
                <PublicImage
                  src={profile.photo_url}
                  alt=""
                  className="size-14 shrink-0 rounded-full object-cover"
                />
              )}
              <div className="min-w-0">
                <h3 className="font-medium break-words">{profile.name}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-6 break-words">
                  {profile.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="grid gap-6 rounded-2xl border bg-white p-6 md:grid-cols-2">
        <div>
          <h2 className="font-semibold">Antes de reservar</h2>
          <p className="mt-3 text-sm leading-6 break-words whitespace-pre-wrap">
            {catalog.settings.cancellation_policy}
          </p>
          <p className="text-muted-foreground mt-3 text-xs">
            Cambios online con al menos{" "}
            {catalog.settings.cancellation_notice_minutes} minutos de
            anticipación.
          </p>
        </div>
        <div>
          <h2 className="font-semibold">Contacto</h2>
          <div className="mt-3 space-y-2 text-sm break-words">
            {catalog.settings.contact_email && (
              <p>{catalog.settings.contact_email}</p>
            )}
            {catalog.settings.contact_phone && (
              <p>{catalog.settings.contact_phone}</p>
            )}
            {catalog.settings.address && <p>{catalog.settings.address}</p>}
            {!catalog.settings.contact_email &&
              !catalog.settings.contact_phone &&
              !catalog.settings.address && (
                <p className="text-muted-foreground">
                  El negocio todavía no publicó información de contacto.
                </p>
              )}
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
function PublicImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className: string;
}) {
  // URLs del negocio se cargan en el navegador, sin proxy de imágenes ni fetch del servidor.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      loading="lazy"
    />
  );
}
