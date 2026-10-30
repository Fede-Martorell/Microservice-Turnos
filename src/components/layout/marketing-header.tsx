"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { Brand } from "./brand";
import { Button } from "@/components/ui/button";
export function MarketingHeader() {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  return (
    <header className="border-border/80 bg-background border-b">
      <div className="mx-auto flex min-h-22 max-w-7xl items-center justify-between gap-5 px-5 md:px-10">
        <Brand />
        <nav
          aria-label="Navegación principal"
          className="hidden items-center gap-8 text-sm md:flex"
        >
          <Link
            href="/#como-funciona"
            className="text-muted-foreground hover:text-primary"
          >
            Cómo funciona
          </Link>
          <Link
            href="/proyecto"
            className="text-muted-foreground hover:text-primary"
          >
            Estado del proyecto
          </Link>
          <Link href="/ingresar" className="font-medium">
            Iniciar sesión
          </Link>
          <Button asChild>
            <Link href="/registro">
              Crear cuenta
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        </nav>
        <Button
          ref={toggle}
          variant="outline"
          size="icon"
          className="size-11 md:hidden"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          aria-controls="marketing-navigation"
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </Button>
      </div>
      {open && (
        <nav
          id="marketing-navigation"
          aria-label="Navegación móvil"
          className="border-t px-5 py-4 md:hidden"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              toggle.current?.focus();
            }
          }}
        >
          <Link
            onClick={() => setOpen(false)}
            href="/#como-funciona"
            className="workspace-nav-link"
          >
            Cómo funciona
          </Link>
          <Link href="/proyecto" className="workspace-nav-link">
            Estado del proyecto
          </Link>
          <Link href="/ingresar" className="workspace-nav-link">
            Iniciar sesión
          </Link>
          <Link href="/registro" className="workspace-nav-link">
            Crear cuenta
          </Link>
        </nav>
      )}
    </header>
  );
}
