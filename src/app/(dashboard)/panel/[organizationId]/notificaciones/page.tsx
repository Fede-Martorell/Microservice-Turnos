import Link from "next/link";
import { z } from "zod";
import { OrganizationScreen } from "@/components/layout/organization-screen";
import { ActionForm } from "@/components/ui/action-form";
import { loadNotifications } from "@/features/notifications/queries";
import { saveNotificationSettingsAction } from "@/features/notifications/actions";
import { notificationConfig } from "@/features/notifications/config";
export const metadata = { title: "Notificaciones" };
const kinds = {
  created: "Reserva recibida",
  confirmed: "Confirmación",
  canceled: "Cancelación",
  rescheduled: "Reprogramación",
  reminder: "Recordatorio",
};
const states = {
  queued: "En cola",
  processing: "Procesando",
  retry: "Reintento pendiente",
  sent: "Aceptado por el proveedor",
  failed: "Falló · revisar configuración",
  skipped: "Omitido",
};
export default async function NotificationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { organizationId: org } = await params;
  const page = z.coerce
    .number()
    .int()
    .min(0)
    .max(2000)
    .catch(0)
    .parse((await searchParams).page ?? 0);
  const { context, settings, jobs } = await loadNotifications(org, page);
  const config = notificationConfig();
  const date = (value: string) =>
    new Intl.DateTimeFormat("es-AR", {
      timeZone: context.organization.timezone,
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  return (
    <OrganizationScreen organizationId={org}>
      <div className="mb-6 space-y-3">
        <h1 className="text-3xl font-semibold">Notificaciones de turnos</h1>
        <p className="text-muted-foreground max-w-3xl text-sm leading-6">
          Emails transaccionales por reserva recibida, confirmada, cancelada o
          reprogramada y recordatorios de turnos confirmados. Las preferencias
          actuales del cliente se revisan antes de cada intento. No se envían
          campañas de marketing.
        </p>
        <p role="status" className="rounded-lg border bg-white p-4 text-sm">
          {!config?.canSend
            ? "Los envíos están desactivados o falta completar la configuración del servidor."
            : config.mode === "test"
              ? "Modo de prueba: solo se procesan reservas del destinatario permitido."
              : "Envíos habilitados en el servidor."}{" "}
          La cola requiere ejecutar el procesador manual o configurar un cron;
          no se envía desde esta pantalla.
        </p>
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[1fr_1.5fr]">
        <section className="space-y-5 rounded-2xl border bg-white p-6">
          <h2 className="text-lg font-semibold">Configuración del negocio</h2>
          <p className="text-muted-foreground text-sm leading-6">
            Al habilitar, se registran los eventos nuevos. No se envían
            confirmaciones históricas. Se programan recordatorios futuros cuando
            todavía queda el margen elegido; un turno cercano no recibe un
            recordatorio inmediato adicional.
          </p>
          <ActionForm
            key={settings?.updated_at ?? "new"}
            action={saveNotificationSettingsAction.bind(null, org)}
            submitLabel="Guardar notificaciones"
            requiresModule={false}
            fields={[
              {
                name: "enabled",
                label: "Registrar avisos por email para este negocio",
                type: "checkbox",
                value: settings?.enabled ?? false,
              },
              {
                name: "reminders_enabled",
                label: "Programar recordatorios de turnos confirmados",
                type: "checkbox",
                value: settings?.reminders_enabled ?? true,
              },
              {
                name: "reminder_minutes",
                label: "Anticipación del recordatorio (minutos)",
                type: "number",
                required: true,
                min: 60,
                max: 10080,
                value: String(settings?.reminder_minutes ?? 1440),
                hint: "1440 = 24 horas. Entre 60 minutos y 7 días.",
              },
            ]}
          />
        </section>
        <section className="space-y-5 rounded-2xl border bg-white p-6">
          <h2 className="text-lg font-semibold">Registro de avisos</h2>
          <p className="text-muted-foreground text-xs leading-5">
            “Aceptado por el proveedor” confirma que Resend aceptó el email, no
            su llegada a la bandeja de entrada. Los avisos desactualizados,
            vencidos o sin permiso se omiten. Los errores se muestran sin datos
            personales.
          </p>
          {!jobs.length && (
            <p className="text-muted-foreground text-sm">
              Todavía no hay avisos. Habilitá la opción y creá una reserva de
              prueba.
            </p>
          )}
          <ol className="space-y-4">
            {jobs.map((job) => (
              <li key={job.id} className="space-y-2 border-t pt-4 text-sm">
                <p className="font-medium">
                  {kinds[job.kind]} · {states[job.status]}
                </p>
                <p className="text-muted-foreground text-xs">
                  Programado: {date(job.scheduled_at)} · {job.attempts} intentos
                  {job.sent_at ? ` · Aceptado: ${date(job.sent_at)}` : ""}
                </p>
                {job.last_error && (
                  <p className="text-muted-foreground text-xs">
                    Código: {job.last_error}
                  </p>
                )}
                <Link
                  className="text-primary inline-flex min-h-11 items-center underline"
                  href={`/panel/${org}/reservas/${job.appointment_id}`}
                >
                  Ver reserva
                </Link>
              </li>
            ))}
          </ol>
          <nav
            aria-label="Páginas de notificaciones"
            className="flex gap-4 text-sm"
          >
            {page > 0 && (
              <Link
                className="text-primary min-h-11 underline"
                href={`?page=${page - 1}`}
              >
                Anterior
              </Link>
            )}
            {jobs.length === 50 && page < 2000 && (
              <Link
                className="text-primary min-h-11 underline"
                href={`?page=${page + 1}`}
              >
                Siguiente
              </Link>
            )}
          </nav>
        </section>
      </div>
    </OrganizationScreen>
  );
}
