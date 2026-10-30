import Link from "next/link";
import { OrganizationScreen } from "@/components/layout/organization-screen";
import { ActionForm } from "@/components/ui/action-form";
import { loadCustomer } from "@/features/customers/queries";
import {
  saveCustomerAction,
  saveCustomerPreferencesAction,
} from "@/features/customers/actions";
import { customerFields } from "@/features/customers/form-fields";
import {
  localDay,
  localTime,
  statusLabels,
} from "@/features/appointments/presentation";
import { z } from "zod";
export const metadata = { title: "Ficha del cliente" };
export default async function CustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string; customerId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { organizationId: org, customerId: id } = await params;
  const page = z.coerce
    .number()
    .int()
    .min(0)
    .max(2000)
    .catch(0)
    .parse((await searchParams).page ?? 0);
  const { context, item, history, summary, preferences } = await loadCustomer(
    org,
    id,
    page,
  );
  const owner = context.role === "owner";
  const zone = context.organization.timezone;
  return (
    <OrganizationScreen organizationId={org}>
      <Link
        href={`/panel/${org}/clientes`}
        className="text-primary mb-5 inline-flex min-h-11 items-center underline"
      >
        ← Volver a clientes
      </Link>
      <h1 className="mb-6 text-3xl font-semibold break-words">{item.name}</h1>
      {owner && (
        <Link
          className="text-primary mb-6 inline-flex min-h-11 items-center text-sm underline"
          href={`/panel/${org}/fidelizacion/clientes/${id}`}
        >
          Ver tarjeta e historial de fidelización
        </Link>
      )}
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <section className="space-y-5 rounded-2xl border bg-white p-6">
            <h2 className="text-lg font-semibold">Ficha del cliente</h2>
            <p className="text-muted-foreground text-sm leading-6">
              Registrado el {localDay(zone, new Date(item.created_at))}.{" "}
              {summary?.completed_visits ?? 0} visitas completadas; última
              visita:{" "}
              {summary?.last_visit
                ? localDay(zone, new Date(summary.last_visit))
                : "sin visitas completadas"}
              .
              {!owner
                ? " Los datos de actividad corresponden solo a tu agenda."
                : ""}
            </p>
            {owner ? (
              <>
                <p className="text-muted-foreground text-xs leading-5">
                  Editar esta ficha conserva los datos históricos de las
                  reservas. Los avisos de cada turno usan el email registrado al
                  reservar; para corregir un turno existente, contactá al
                  cliente y revisá sus avisos pendientes.
                </p>
                <ActionForm
                  key={`customer-${item.version}`}
                  action={saveCustomerAction.bind(null, org, id, item.version)}
                  fields={customerFields(item)}
                  submitLabel="Guardar ficha"
                  requiresModule="customers"
                />
              </>
            ) : (
              <dl className="space-y-3 text-sm break-words">
                <div>
                  <dt>Email</dt>
                  <dd>{item.email}</dd>
                </div>
                <div>
                  <dt>Teléfono</dt>
                  <dd>{item.phone || "Sin teléfono registrado"}</dd>
                </div>
              </dl>
            )}
          </section>
          {owner && (
            <section className="space-y-5 rounded-2xl border bg-white p-6">
              <h2 className="text-lg font-semibold">
                Preferencias de comunicación
              </h2>
              <p className="text-muted-foreground text-sm leading-6">
                Los avisos de turnos son transaccionales. Marketing requiere
                consentimiento expreso y evidencia; esta etapa registra la
                preferencia y no envía campañas. Desactivar avisos se aplica
                antes de cada nuevo intento de entrega.
              </p>
              <ActionForm
                key={`preferences-${item.version}`}
                action={saveCustomerPreferencesAction.bind(
                  null,
                  org,
                  id,
                  item.version,
                )}
                submitLabel="Registrar preferencias"
                requiresModule={false}
                fields={[
                  {
                    name: "transactional_email",
                    label: "Recibir emails sobre sus turnos",
                    type: "checkbox",
                    value: preferences?.transactional_email ?? false,
                  },
                  {
                    name: "marketing_consent",
                    label:
                      "El cliente dio consentimiento expreso para marketing",
                    type: "checkbox",
                    value: preferences?.marketing_consent ?? false,
                  },
                  {
                    name: "consent_evidence",
                    label:
                      "Evidencia del consentimiento o solicitud del cliente",
                    type: "textarea",
                    maxLength: 500,
                    value: preferences?.consent_evidence ?? "",
                    hint: "Si autorizó marketing, indicá cómo y cuándo. No registres datos sensibles.",
                  },
                ]}
              />
              <p className="text-muted-foreground text-xs">
                Para solicitudes de acceso, corrección o eliminación, verificá
                identidad y seguí el procedimiento de privacidad del proyecto.
                No se borra historial desde esta pantalla.
              </p>
            </section>
          )}
        </div>
        <section className="space-y-5 rounded-2xl border bg-white p-6">
          <h2 className="text-lg font-semibold">
            Historial de reservas y servicios
          </h2>
          {history.length ? (
            <ol className="space-y-4">
              {history.map((booking) => (
                <li key={booking.id} className="border-t pt-4 text-sm">
                  <Link
                    className="text-primary inline-flex min-h-11 items-center font-medium underline"
                    href={`/panel/${org}/reservas/${booking.id}`}
                  >
                    {booking.service_name}
                  </Link>
                  <p>
                    {localDay(zone, new Date(booking.starts_at))} ·{" "}
                    {localTime(booking.starts_at, zone)}
                  </p>
                  <p className="text-muted-foreground mt-2">
                    {booking.staff_name} · {statusLabels[booking.status]}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted-foreground text-sm">
              Sin reservas visibles en esta página.
            </p>
          )}
          <nav
            aria-label="Páginas del historial"
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
            {history.length === 50 && page < 2000 && (
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
