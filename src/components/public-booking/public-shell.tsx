import Link from "next/link";
import { CalendarDays, Check } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import type { PublicCatalog } from "@/features/public-booking/schema";
export function contrastText(hex: string) {
  const channel = (offset: number) => {
    const n = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  };
  const light = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return (light + 0.05) / 0.05 > 1.05 / (light + 0.05) ? "#000000" : "#ffffff";
}
export function PublicShell({
  catalog,
  children,
}: {
  catalog?: PublicCatalog;
  children: ReactNode;
}) {
  const settings = catalog?.settings;
  const primary = settings?.primary_color ?? "#355741",
    secondary = settings?.secondary_color ?? "#eaf0e6";
  const style = {
    "--public-primary": primary,
    "--public-primary-text": contrastText(primary),
    "--public-secondary": secondary,
    "--public-secondary-text": contrastText(secondary),
  } as CSSProperties;
  return (
    <div style={style} className="public-workspace bg-background min-h-dvh">
      <header className="border-b bg-white">
        <div className="mx-auto flex min-h-22 max-w-5xl items-center justify-between gap-4 px-5 md:px-8">
          <Link
            href={catalog ? `/b/${catalog.organization.slug}` : "/"}
            className="flex min-w-0 items-center gap-3 text-base font-semibold break-words"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--public-primary)] text-[var(--public-primary-text)]">
              <CalendarDays className="size-5" strokeWidth={1.6} />
            </span>
            <span className="min-w-0">
              {catalog?.organization.name ?? "Reservas"}
            </span>
          </Link>
          <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-[11px]">
            <Check className="size-3.5" />
            Reservas online
          </span>
        </div>
      </header>
      <main
        id="contenido"
        className="mx-auto max-w-5xl space-y-7 px-5 py-8 md:px-8 md:py-12"
      >
        {children}
      </main>
      <footer className="text-muted-foreground mx-auto max-w-5xl border-t px-5 py-8 text-[11px] leading-6 md:px-8">
        Reservas · Horarios del negocio. Sin cargos online desde esta página.
      </footer>
    </div>
  );
}
export function PublicUnavailable({
  message = "Las reservas online no están disponibles en este momento. Volvé a intentar más tarde.",
}: {
  message?: string;
}) {
  return (
    <PublicShell>
      <section className="mx-auto max-w-lg rounded-2xl border bg-white p-7">
        <h1 className="text-2xl font-semibold">Reservas no disponibles</h1>
        <p className="text-muted-foreground mt-4 text-sm leading-7">
          {message}
        </p>
      </section>
    </PublicShell>
  );
}
