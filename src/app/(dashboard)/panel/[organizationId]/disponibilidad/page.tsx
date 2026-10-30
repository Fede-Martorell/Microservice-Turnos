import Link from "next/link";
import { notFound } from "next/navigation";
import { loadCatalog } from "@/features/services/queries";
import { OrganizationScreen } from "@/components/layout/organization-screen";
import { ActionForm } from "@/components/ui/action-form";
import { loadBookingSettings } from "@/features/appointments/queries";
import { saveBookingSettingsAction } from "@/features/appointments/actions";
import { ruleFields, exceptionFields } from "@/features/staff/form-fields";
import { weekdays, minuteInput } from "@/features/staff/availability-schema";
import {
  saveRuleAction,
  saveExceptionAction,
  removeAvailabilityAction,
} from "@/features/staff/availability-actions";

export const metadata = { title: "Disponibilidad" };

export default async function AvailabilityPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ profesional?: string | string[] }>;
}) {
  const { organizationId: org } = await params;
  const query = await searchParams;
  const data = await loadCatalog(org);
  const staffId =
    typeof query.profesional === "string" && query.profesional
      ? query.profesional
      : null;
  const profile = staffId
    ? data.professionals.find((item) => item.id === staffId)
    : null;
  if (staffId && !profile) notFound();
  const owner = data.context.role === "owner";
  const bookingSettings = await loadBookingSettings(org);
  const rules = data.rules.filter((item) => item.staff_id === staffId);
  const exceptions = data.exceptions.filter(
    (item) => item.staff_id === staffId,
  );
  return (
    <OrganizationScreen organizationId={org}>
      <div className="mb-6 space-y-3">
        <h1 className="text-3xl font-semibold">Disponibilidad</h1>
        <p className="text-muted-foreground max-w-3xl text-sm leading-6">
          Horarios en {data.context.organization.timezone}. Para poder ofrecer
          turnos, el horario del negocio y el del profesional deben coincidir.
          Los descansos y bloqueos de cualquiera de los dos se descuentan. Sin
          horario de trabajo configurado, no hay disponibilidad.
        </p>
        <nav
          aria-label="Ámbito de disponibilidad"
          className="flex flex-wrap gap-2"
        >
          {[{ id: null, name: "Negocio" }, ...data.professionals].map(
            (item) => (
              <Link
                key={item.id ?? "business"}
                href={`/panel/${org}/disponibilidad${item.id ? `?profesional=${item.id}` : ""}`}
                aria-current={item.id === staffId ? "page" : undefined}
                className={`inline-flex min-h-11 max-w-full items-center rounded-lg border px-4 text-sm break-words ${item.id === staffId ? "bg-primary text-white" : "bg-white"}`}
              >
                {item.name}
              </Link>
            ),
          )}
        </nav>
      </div>
      <details className="mb-6 rounded-xl border bg-white p-5">
        <summary className="min-h-11 cursor-pointer py-3 font-medium">
          Anticipación para reservar · todo el negocio
        </summary>
        <p className="text-muted-foreground mb-5 text-sm leading-6">
          Mínimo actual: {bookingSettings.min_advance_minutes} minutos. Máximo:{" "}
          {bookingSettings.max_advance_days} días de 24 horas desde ahora. Las
          reservas existentes conservan su horario aunque se modifique la
          configuración.
        </p>
        {owner && (
          <ActionForm
            action={saveBookingSettingsAction.bind(null, org)}
            fields={[
              {
                name: "min_advance_minutes",
                label: "Anticipación mínima (minutos)",
                type: "number",
                required: true,
                min: 0,
                max: 43200,
                value: String(bookingSettings.min_advance_minutes),
              },
              {
                name: "max_advance_days",
                label: "Anticipación máxima (días)",
                type: "number",
                required: true,
                min: 1,
                max: 365,
                value: String(bookingSettings.max_advance_days),
              },
            ]}
            submitLabel="Guardar anticipación"
          />
        )}
      </details>
      <h2 className="mb-5 text-xl font-semibold break-words">
        {profile?.name ?? "Todo el negocio"}
      </h2>
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <section className="space-y-5 rounded-2xl border bg-white p-6">
          <h3 className="text-lg font-semibold">Semana habitual</h3>
          {rules.length === 0 && (
            <p className="text-muted-foreground text-sm">
              No hay intervalos configurados en este ámbito.
            </p>
          )}
          {rules.map((rule) => (
            <div key={rule.id} className="space-y-3 border-t pt-4">
              <p className="text-sm font-medium">
                {weekdays[rule.weekday]} · {minuteInput(rule.start_minute)}–
                {minuteInput(rule.end_minute)} ·{" "}
                {rule.kind === "working" ? "Trabajo" : "Descanso"}
              </p>
              {owner && (
                <details>
                  <summary className="text-primary min-h-11 cursor-pointer py-3 text-sm">
                    Editar o eliminar intervalo
                  </summary>
                  <div className="space-y-5">
                    <ActionForm
                      action={saveRuleAction.bind(null, org, staffId, rule.id)}
                      fields={ruleFields(rule)}
                      submitLabel="Guardar intervalo"
                    />
                    <ActionForm
                      action={removeAvailabilityAction.bind(
                        null,
                        org,
                        rule.id,
                        "rule",
                      )}
                      fields={[]}
                      submitLabel="Eliminar intervalo"
                    />
                  </div>
                </details>
              )}
            </div>
          ))}
          {owner && (
            <details className="border-t pt-4">
              <summary className="min-h-11 cursor-pointer py-3 font-medium">
                Agregar intervalo semanal
              </summary>
              <ActionForm
                action={saveRuleAction.bind(null, org, staffId, null)}
                fields={ruleFields()}
                submitLabel="Agregar intervalo"
                resetOnSuccess
              />
            </details>
          )}
        </section>
        <section className="space-y-5 rounded-2xl border bg-white p-6">
          <h3 className="text-lg font-semibold">Bloqueos y vacaciones</h3>
          <p className="text-muted-foreground text-xs leading-5">
            Las fechas son inclusivas. Un bloqueo con horas se aplica en ese
            tramo a cada día del rango.
          </p>
          {exceptions.length === 0 && (
            <p className="text-muted-foreground text-sm">
              No hay bloqueos configurados en este ámbito.
            </p>
          )}
          {exceptions.map((exception) => (
            <div key={exception.id} className="space-y-3 border-t pt-4">
              <p className="text-sm font-medium">
                {exception.starts_on} → {exception.ends_on} ·{" "}
                {exception.kind === "vacation"
                  ? "Vacaciones"
                  : exception.kind === "holiday"
                    ? "Día no laborable"
                    : "Bloqueo"}
              </p>
              <p className="text-sm">
                {exception.start_minute === null ||
                exception.end_minute === null
                  ? "Días completos"
                  : `${minuteInput(exception.start_minute)}–${minuteInput(exception.end_minute)}`}
              </p>
              {exception.reason && (
                <p className="text-muted-foreground text-sm break-words">
                  {exception.reason}
                </p>
              )}
              {owner && (
                <details>
                  <summary className="text-primary min-h-11 cursor-pointer py-3 text-sm">
                    Editar o eliminar bloqueo
                  </summary>
                  <div className="space-y-5">
                    <ActionForm
                      action={saveExceptionAction.bind(
                        null,
                        org,
                        staffId,
                        exception.id,
                      )}
                      fields={exceptionFields(exception)}
                      submitLabel="Guardar bloqueo"
                    />
                    <ActionForm
                      action={removeAvailabilityAction.bind(
                        null,
                        org,
                        exception.id,
                        "exception",
                      )}
                      fields={[]}
                      submitLabel="Eliminar bloqueo"
                    />
                  </div>
                </details>
              )}
            </div>
          ))}
          {owner && (
            <details className="border-t pt-4">
              <summary className="min-h-11 cursor-pointer py-3 font-medium">
                Agregar bloqueo o vacaciones
              </summary>
              <ActionForm
                action={saveExceptionAction.bind(null, org, staffId, null)}
                fields={exceptionFields()}
                submitLabel="Agregar bloqueo"
                resetOnSuccess
              />
            </details>
          )}
        </section>
      </div>
    </OrganizationScreen>
  );
}
