import Link from "next/link";
import { CircleCheck, CircleDashed, ArrowUpRight } from "lucide-react";
import type { BusinessOnboarding as Data } from "@/features/onboarding/schema";
import { cn } from "@/lib/utils";

export function BusinessOnboarding({
  data,
  base,
}: {
  data: Data;
  base: string;
}) {
  const steps = [
    {
      ready: data.professional_ready,
      title: "Sumá un profesional",
      detail: "Al menos una persona activa que pueda atender las reservas.",
      path: "equipo",
    },
    {
      ready: data.service_ready,
      title: "Creá y asigná un servicio",
      detail:
        "Un servicio activo, con duración y preparación, asignado a un profesional activo.",
      path: "servicios",
    },
    {
      ready: data.business_hours_ready,
      title: "Definí los horarios del negocio",
      detail:
        "Agregá un horario de Trabajo para Negocio, además del horario de cada profesional.",
      path: "disponibilidad",
    },
    {
      ready: data.matching_hours_ready,
      title: "Hacé coincidir los horarios",
      detail:
        "Negocio y profesional deben compartir un tramo que alcance para el servicio y su preparación, sin pausas.",
      path: "disponibilidad",
    },
  ];
  const completed = steps.filter((step) => step.ready).length;
  return (
    <>
      <p className="eyebrow">Todo listo para empezar</p>
      <h1 className="page-title mt-3">Puesta en marcha</h1>
      <p className="text-muted-foreground mt-4 max-w-2xl text-sm leading-7">
        Configurá lo esencial para recibir tus primeros turnos. Este recorrido
        se actualiza con los datos de tu negocio cada vez que abrís la página.
      </p>
      <div className="surface-panel mt-7 p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Tu configuración inicial</h2>
          <span className="status-pill bg-sage text-primary">
            {completed} de {steps.length} pasos completos
          </span>
        </div>
        <progress
          className="setup-progress mt-5 h-2 w-full"
          value={completed}
          max={steps.length}
          aria-label="Configuración inicial completada"
        />
        <ol className="mt-4 divide-y">
          {steps.map((step) => (
            <li key={step.title} className="flex items-start gap-3 py-5">
              {step.ready ? (
                <CircleCheck
                  aria-hidden
                  className="text-primary mt-1 size-5 shrink-0"
                />
              ) : (
                <CircleDashed
                  aria-hidden
                  className="text-muted-foreground mt-1 size-5 shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground text-xs">
                  {step.ready ? "Completo" : "Por completar"}
                </p>
                <h3 className="mt-1 font-medium">{step.title}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-6">
                  {step.detail}
                </p>
                <Link
                  href={`${base}/${step.path}`}
                  className="text-primary mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-medium underline underline-offset-4"
                >
                  Revisar <span className="sr-only">{step.title}</span>
                  <ArrowUpRight aria-hidden className="size-4" />
                </Link>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <section
        className={cn(
          "surface-panel mt-5 p-5 md:p-6",
          completed === 4 && "border-primary/20",
        )}
        aria-labelledby="first-booking-title"
      >
        <h2 id="first-booking-title" className="font-semibold">
          Probá tu primera reserva
        </h2>
        <p className="text-muted-foreground mt-3 text-sm leading-7">
          Los pasos anteriores revisan la semana habitual. Feriados, ausencias,
          turnos existentes, anticipación y vigencia del plan pueden cambiar la
          disponibilidad de una fecha. Confirmalo en el calendario.
        </p>
        <p className="mt-3 text-sm">
          {data.booking_recorded
            ? "Ya registraste una reserva en este negocio."
            : "Todavía no registraste una reserva en este negocio."}
        </p>
        <Link
          className="text-primary mt-3 inline-flex min-h-11 items-center text-sm font-medium underline"
          href={`${base}/calendario`}
        >
          Abrir calendario
        </Link>
      </section>
      <section
        className="surface-panel mt-5 p-5 md:p-6"
        aria-labelledby="public-onboarding-title"
      >
        <h2 id="public-onboarding-title" className="font-semibold">
          Si vas a recibir reservas online
        </h2>
        <p className="text-muted-foreground mt-3 text-sm leading-7">
          Con el módulo disponible en tu plan, revisá la información del negocio
          y su política de cancelación. Habilitá la página cuando quieras
          compartirla y probá una reserva y su enlace privado en incógnito.
        </p>
        <p className="mt-3 text-sm">
          Página pública:{" "}
          {data.public_enabled
            ? "habilitada en la configuración"
            : "sin habilitar"}
          . La disponibilidad también depende de tu suscripción.
        </p>
        <Link
          className="text-primary mt-3 inline-flex min-h-11 items-center text-sm font-medium underline"
          href={`${base}/suscripcion`}
        >
          Consultar mi suscripción
        </Link>
        <p className="text-muted-foreground mt-4 text-xs leading-6">
          Este recorrido no activa emails ni realiza cobros. Los avisos
          requieren configuración y habilitación por separado.
        </p>
      </section>
    </>
  );
}
