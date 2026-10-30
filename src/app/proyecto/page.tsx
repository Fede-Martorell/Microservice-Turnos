import type { Metadata } from "next";
import { ArrowLeft, CircleCheck, CircleDashed } from "lucide-react";
import Link from "next/link";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { projectPhases } from "@/lib/config/project";

export const metadata: Metadata = { title: "Estado del proyecto" };

export default function ProjectPage() {
  return (
    <WorkspaceShell>
      <Link
        href="/"
        className="text-muted-foreground hover:text-primary mb-7 inline-flex items-center gap-2 text-sm"
      >
        <ArrowLeft className="size-4" />
        Volver al inicio
      </Link>
      <p className="text-primary mb-3 text-xs font-medium tracking-wider uppercase">
        Desarrollo incremental
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">
        Una buena base, paso a paso.
      </h1>
      <p className="text-muted-foreground mt-4 max-w-2xl text-sm leading-7">
        Estamos preparando la Fase 9: un piloto cerrado para pocos negocios, con
        una puesta en marcha guiada y revisión de la operación. La publicación
        del piloto todavía está pendiente.
      </p>
      <section className="mt-8 rounded-xl border bg-white p-6">
        <h2 className="text-lg font-semibold">Qué podés usar hoy</h2>
        <p className="text-muted-foreground mt-3 text-sm leading-7">
          La pantalla de inicio, registro, inicio de sesión y panel de
          organizaciones, catálogo de servicios, equipo, disponibilidad y
          reservas privadas y públicas con enlaces para gestionar turnos, fichas
          de clientes e historial. Los emails y recordatorios requieren
          configurar Resend, habilitar avisos y ejecutar el procesador. El
          acceso requiere configurar Supabase y aplicar las migraciones. La
          instalación como aplicación web se prepara mediante manifest e iconos;
          requiere HTTPS en un navegador compatible.
        </p>
        <p className="text-muted-foreground mt-3 text-sm leading-7">
          Fidelización permite configurar reglas, acreditar al completar turnos,
          registrar canjes y compartir tarjetas privadas si el complemento está
          habilitado. Podés consultar el plan del negocio y enviar feedback de
          un piloto. La administración interna gestiona planes y períodos de
          acceso. Los pagos todavía no están implementados. Las operaciones
          requieren conexión a internet. Cada negocio decide si habilita su
          página pública.
        </p>
      </section>
      <section id="hoja-de-ruta" className="mt-10 scroll-mt-6">
        <h2 className="mb-5 text-xl font-semibold">Hoja de ruta</h2>
        <ol className="space-y-3">
          {projectPhases.map((phase) => (
            <li
              key={phase.number}
              className="flex gap-4 rounded-xl border bg-white p-5"
            >
              {phase.state === "completed" ? (
                <CircleCheck className="text-primary mt-1 size-5 shrink-0" />
              ) : (
                <CircleDashed className="text-muted-foreground mt-1 size-5 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">
                    Fase {phase.number} · {phase.title}
                  </h3>
                  <span className="text-muted-foreground text-xs">
                    {phase.state === "completed"
                      ? "Implementada"
                      : "Etapa actual"}
                  </span>
                </div>
                <p className="text-muted-foreground mt-2 text-sm leading-6">
                  {phase.detail}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </WorkspaceShell>
  );
}
