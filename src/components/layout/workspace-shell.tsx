"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import {
  CalendarDays,
  ChartNoAxesCombined,
  House,
  Layers3,
  UsersRound,
  BriefcaseBusiness,
  ContactRound,
  Settings2,
  CreditCard,
  Gift,
  ArrowUpRight,
  Menu,
  X,
  ChevronRight,
  Globe2,
  Mail,
} from "lucide-react";
import { Brand } from "./brand";
import { Button } from "@/components/ui/button";

export function WorkspaceShell({
  children,
  role,
  modules,
}: {
  children: React.ReactNode;
  role?: "owner" | "staff";
  modules?: string[];
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const organizationId = /^\/panel\/([0-9a-f-]{36})(?:\/|$)/i.exec(
    pathname,
  )?.[1];
  const managementNavigation = (
    organizationId
      ? [
          {
            label: "Resumen y estadísticas",
            path: "",
            icon: ChartNoAxesCombined,
          },
          {
            label: "Puesta en marcha",
            path: "puesta-en-marcha",
            icon: BriefcaseBusiness,
          },
          {
            label: "Calendario y reservas",
            path: "calendario",
            icon: CalendarDays,
          },
          { label: "Clientes", path: "clientes", icon: ContactRound },
          { label: "Servicios", path: "servicios", icon: Layers3 },
          { label: "Equipo", path: "equipo", icon: UsersRound },
          {
            label: "Disponibilidad",
            path: "disponibilidad",
            icon: CalendarDays,
          },
          { label: "Página pública", path: "pagina-publica", icon: Globe2 },
          { label: "Fidelización", path: "fidelizacion", icon: Gift },
          { label: "Notificaciones", path: "notificaciones", icon: Mail },
          { label: "Configuración", path: "configuracion", icon: Settings2 },
          { label: "Suscripción", path: "suscripcion", icon: CreditCard },
        ]
      : []
  )
    .filter((item) => {
      if (item.path === "" || item.path === "puesta-en-marcha")
        return role === "owner";
      if (item.path === "fidelizacion")
        return role === "owner" && Boolean(modules?.includes("loyalty"));
      if (item.path === "pagina-publica")
        return role === "owner" && Boolean(modules?.includes("public_booking"));
      if (item.path === "notificaciones")
        return role === "owner" && Boolean(modules?.includes("notifications"));
      if (item.path === "suscripcion") return role === "owner";
      if (!modules || item.path === "configuracion") return true;
      if (item.path === "clientes")
        return modules.includes("customers") || role === "owner";
      return (
        modules.includes("bookings") ||
        (role === "owner" && item.path === "calendario")
      );
    })
    .map((item) => ({
      ...item,
      label:
        modules && item.path === "clientes" && !modules.includes("customers")
          ? "Historial de clientes"
          : modules &&
              item.path === "calendario" &&
              !modules.includes("bookings")
            ? "Historial de reservas"
            : item.label,
      href: `/panel/${organizationId}${item.path ? `/${item.path}` : ""}`,
    }));
  const pageTitle =
    managementNavigation.find((item) =>
      item.path ? pathname.startsWith(item.href) : pathname === item.href,
    )?.label ??
    (pathname.includes("/reservas")
      ? "Calendario y reservas"
      : pathname.startsWith("/panel")
        ? "Mis organizaciones"
        : pathname === "/"
          ? "Inicio"
          : "Estado del proyecto");
  const active = (href: string) =>
    href === `/panel/${organizationId}`
      ? pathname === href
      : pathname.startsWith(href);
  return (
    <div className="min-h-dvh lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col overflow-y-auto border-r bg-white lg:flex">
        <div className="px-7 py-8">
          <Brand />
        </div>
        <div className="bg-background mx-5 mb-6 flex items-center gap-3 rounded-xl border p-3.5">
          <span className="text-primary flex size-9 shrink-0 items-center justify-center rounded-lg border bg-white">
            <BriefcaseBusiness className="size-4" />
          </span>
          <div>
            <p className="text-[13px] font-medium">Tu espacio de trabajo</p>
            <p className="text-muted-foreground mt-0.5 text-[11px]">
              Un lugar para tu negocio
            </p>
          </div>
        </div>
        <nav aria-label="Navegación principal" className="px-4">
          <Link
            href="/"
            className="workspace-nav-link"
            aria-current={pathname === "/" ? "page" : undefined}
          >
            <House className="size-[18px]" />
            Inicio
          </Link>
          <Link
            href="/panel"
            className="workspace-nav-link"
            aria-current={pathname === "/panel" ? "page" : undefined}
          >
            <BriefcaseBusiness className="size-[18px]" />
            Mis organizaciones
          </Link>
          {organizationId && (
            <p className="text-muted-foreground mt-7 mb-2 px-3 text-[10px] font-semibold tracking-[0.14em] uppercase">
              Gestión del negocio
            </p>
          )}
          {managementNavigation.map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="workspace-nav-link"
              aria-current={active(href) ? "page" : undefined}
            >
              <Icon className="size-[18px]" strokeWidth={1.7} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto px-5 pt-8 pb-6">
          <Link
            href="/proyecto"
            className="text-muted-foreground hover:bg-muted flex items-center justify-between rounded-xl border p-3.5 text-xs"
          >
            <span className="flex items-center gap-2">
              <Layers3 className="size-4" />
              Estado del proyecto
            </span>
            <ArrowUpRight className="size-3.5" />
          </Link>
          <p className="text-muted-foreground mt-4 px-1 text-[10px]">
            Reservas · Versión en pruebas
          </p>
        </div>
      </aside>
      <header className="flex min-h-18 items-center justify-between gap-3 border-b bg-white px-5 md:px-9">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            ref={toggle}
            variant="ghost"
            size="icon"
            className="size-11 lg:hidden"
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X /> : <Menu />}
          </Button>
          <span className="text-muted-foreground hidden text-xs md:block">
            Espacio de trabajo
          </span>
          <ChevronRight className="text-muted-foreground hidden size-3 md:block" />
          <span className="truncate text-[13px] font-medium">{pageTitle}</span>
        </div>
        <Link
          href="/panel"
          className="bg-background text-muted-foreground shrink-0 rounded-full border px-3 py-1.5 text-[11px]"
        >
          Mi espacio
        </Link>
      </header>
      {menuOpen && (
        <nav
          id="mobile-navigation"
          aria-label="Navegación móvil"
          className="border-b bg-white p-4 lg:hidden"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setMenuOpen(false);
              toggle.current?.focus();
            }
          }}
        >
          <Link
            href="/"
            onClick={() => setMenuOpen(false)}
            className="workspace-nav-link"
          >
            Inicio
          </Link>
          <Link
            href="/panel"
            onClick={() => setMenuOpen(false)}
            className="workspace-nav-link"
          >
            Mis organizaciones
          </Link>
          {managementNavigation.map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              className="workspace-nav-link"
              aria-current={active(href) ? "page" : undefined}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
          <Link
            href="/proyecto"
            onClick={() => setMenuOpen(false)}
            className="workspace-nav-link"
          >
            Estado del proyecto
          </Link>
        </nav>
      )}
      <main
        id="contenido"
        className="mx-auto max-w-7xl px-5 py-7 md:px-9 md:py-9"
      >
        {children}
      </main>
    </div>
  );
}
