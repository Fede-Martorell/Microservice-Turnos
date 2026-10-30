import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  UsersRound,
  Gift,
  ArrowUpRight,
} from "lucide-react";
import { Brand } from "@/components/layout/brand";
export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main id="contenido" className="grid min-h-dvh lg:grid-cols-2">
      <aside className="bg-ink flex flex-col px-6 py-7 text-white md:px-10 lg:px-14 lg:py-10">
        <Brand inverse />
        <div className="my-auto hidden py-20 lg:block">
          <p className="mb-6 text-[11px] tracking-widest text-white/65 uppercase">
            Un espacio para lo que hacés mejor
          </p>
          <h2 className="editorial-title max-w-lg text-6xl">
            Tu negocio,
            <br />
            con más calma.
          </h2>
          <p className="mt-6 max-w-sm text-sm leading-8 text-white/75">
            La agenda, el equipo y tus clientes. Todo más cerca, todo más
            simple.
          </p>
          <div className="mt-10 space-y-5">
            {[
              { icon: CalendarDays, text: "Una agenda clara para cada día" },
              {
                icon: UsersRound,
                text: "La información de tus clientes, a mano",
              },
              { icon: Gift, text: "Fidelización con las reglas de tu negocio" },
            ].map(({ icon: Icon, text }) => (
              <p
                key={text}
                className="flex items-center gap-3 text-[13px] text-white/80"
              >
                <Icon className="size-4 text-white/65" strokeWidth={1.5} />
                {text}
              </p>
            ))}
          </div>
        </div>
        <Link
          href="/"
          className="mt-6 hidden items-center gap-2 text-xs text-white/70 hover:text-white lg:flex"
        >
          Conocé Reservas
          <ArrowUpRight className="size-3.5" />
        </Link>
      </aside>
      <div className="flex flex-col items-center justify-center px-5 py-10 sm:px-8 lg:py-16">
        <section className="w-full max-w-md">
          <p className="eyebrow mb-4">Tu espacio te espera</p>
          <h1 className="editorial-title text-4xl sm:text-5xl">{title}</h1>
          <p className="text-muted-foreground mt-4 text-sm leading-7">
            {description}
          </p>
          {children}
        </section>
        <Link
          href="/"
          className="text-muted-foreground hover:text-primary mt-8 inline-flex items-center gap-2 rounded p-2 text-xs"
        >
          <ArrowLeft className="size-3.5" />
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
export function AuthSetupNotice() {
  return (
    <div
      role="status"
      className="mt-6 space-y-3 rounded-xl border bg-white p-5 text-sm leading-6"
    >
      <p className="font-medium">Acceso pendiente de configuración</p>
      <p>
        El registro y el inicio de sesión se habilitarán cuando se conecte el
        entorno de autenticación. Todavía no podés crear una cuenta desde esta
        instalación.
      </p>
    </div>
  );
}
