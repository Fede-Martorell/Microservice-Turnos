import Link from "next/link";
import { ActionForm, type FormField } from "@/components/ui/action-form";
import { AuditList } from "@/components/subscriptions/audit-list";
import {
  loadAdminOrganization,
  loadPlanCatalog,
} from "@/features/subscriptions/queries";
import {
  saveSubscriptionAction,
  saveModuleAction,
  saveOrganizationStatusAction,
} from "@/features/subscriptions/actions";
import { subscriptionStatuses } from "@/features/subscriptions/schema";
import {
  formatTimestamp,
  localDay,
  lastDay,
  periodText,
} from "@/features/subscriptions/presentation";
import { formatMoney } from "@/lib/utils/money";
export const metadata = { title: "Acceso del negocio" };
export default async function AdminOrganizationPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId: org } = await params;
  const [{ detail, feedback, audit }, catalog] = await Promise.all([
    loadAdminOrganization(org),
    loadPlanCatalog(),
  ]);
  const { organization: o, subscription: s } = detail;
  const periods = (starts = s.starts_at, ends = s.ends_at): FormField[] => [
    {
      name: "starts_on",
      label: "Inicio",
      type: "date",
      value: localDay(starts, o.timezone),
      required: true,
    },
    {
      name: "ends_on",
      label: "Último día con acceso (inclusive)",
      type: "date",
      value: lastDay(ends, o.timezone),
      required: true,
      hint: `Se aplica la zona horaria ${o.timezone}. Máximo 367 días por período.`,
    },
    {
      name: "reason",
      label: "Motivo del cambio",
      required: true,
      maxLength: 300,
      hint: "De 5 a 300 caracteres. Se registra en auditoría.",
    },
  ];
  const moduleOptions = catalog.modules
    .filter((m) => m.is_available)
    .map((m) => ({ value: m.code, label: m.name }));
  return (
    <>
      <Link className="text-primary text-sm underline" href="/admin">
        ← Negocios
      </Link>
      <h1 className="mt-4 text-3xl font-semibold break-words">{o.name}</h1>
      <p className="text-muted-foreground mt-2 text-sm break-all">
        /{o.slug} · {o.timezone} · Negocio {o.status}
      </p>
      <section className="my-6 rounded-2xl border bg-white p-6">
        <h2 className="mb-3 text-xl font-semibold">Plan y período de acceso</h2>
        <p className="mb-2 text-sm">
          {s.plan_code} · {subscriptionStatuses[s.status]} ·{" "}
          {detail.active_professionals} profesionales activos.
        </p>
        <p className="mb-2 text-sm">
          {periodText(s.starts_at, s.ends_at, o.timezone)}.
        </p>
        <p className="text-muted-foreground mb-5 text-sm">
          Referencia registrada:{" "}
          {formatMoney(s.quoted_price_minor, s.quoted_currency)}. Piloto y
          prueba son gratuitos. Asignar «Activo» registra el acceso comercial
          acordado; no realiza un cobro.
        </p>
        <ActionForm
          key={`sub-${s.version}`}
          action={saveSubscriptionAction.bind(null, org, s.version)}
          submitLabel="Guardar acceso"
          fields={[
            {
              name: "plan",
              label: "Plan",
              type: "select",
              value: s.plan_code,
              required: true,
              options: catalog.plans
                .filter((p) => p.is_active || p.code === s.plan_code)
                .map((p) => ({
                  value: p.code,
                  label:
                    p.name +
                    (p.is_active ? "" : " (inactivo: elegí otro para guardar)"),
                })),
            },
            {
              name: "status",
              label: "Estado",
              type: "select",
              value: s.status,
              required: true,
              options: Object.entries(subscriptionStatuses).map(
                ([value, label]) => ({ value, label }),
              ),
            },
            ...periods(),
            {
              name: "notes",
              label: "Notas internas del piloto",
              type: "textarea",
              value: detail.notes,
              maxLength: 2000,
              hint: "Solo administración. No incluyas datos de clientes.",
            },
          ]}
        />
      </section>
      <section className="mb-6 rounded-2xl border bg-white p-6">
        <h2 className="mb-3 text-xl font-semibold">Excepciones de módulos</h2>
        <p className="text-muted-foreground mb-5 text-sm leading-6">
          Permiten habilitar o bloquear un módulo durante un período. Al
          terminar vuelve a regir el plan. Requieren que la suscripción esté
          vigente; no extienden su vencimiento. Los módulos futuros siguen
          inactivos.
        </p>
        {detail.overrides.map((m) => (
          <details className="mb-4 rounded-xl border p-4" key={m.module_code}>
            <summary className="cursor-pointer font-medium">
              {moduleOptions.find((x) => x.value === m.module_code)?.label ??
                m.module_code}{" "}
              · {m.enabled ? "Habilitar" : "Bloquear"}
            </summary>
            <div className="mt-5">
              <p className="text-muted-foreground mb-3 text-xs">
                Motivo anterior: {m.reason}
              </p>
              <ActionForm
                key={`mod-${m.module_code}-${m.version}`}
                action={saveModuleAction.bind(
                  null,
                  org,
                  m.module_code,
                  m.version,
                )}
                submitLabel="Guardar excepción"
                fields={[
                  {
                    name: "enabled",
                    label:
                      "Habilitar durante el período (desmarcado: bloquear)",
                    type: "checkbox",
                    value: m.enabled,
                  },
                  ...periods(m.starts_at, m.ends_at),
                ]}
              />
            </div>
          </details>
        ))}
        {moduleOptions.some(
          (x) => !detail.overrides.some((m) => m.module_code === x.value),
        ) && (
          <details className="rounded-xl border p-4">
            <summary className="cursor-pointer font-medium">
              Agregar excepción
            </summary>
            <div className="mt-5">
              <ActionForm
                action={saveModuleAction.bind(null, org, null, null)}
                submitLabel="Agregar excepción"
                fields={[
                  {
                    name: "module",
                    label: "Módulo",
                    type: "select",
                    required: true,
                    options: moduleOptions.filter(
                      (x) =>
                        !detail.overrides.some(
                          (m) => m.module_code === x.value,
                        ),
                    ),
                  },
                  {
                    name: "enabled",
                    label:
                      "Habilitar durante el período (desmarcado: bloquear)",
                    type: "checkbox",
                    value: true,
                  },
                  ...periods(),
                ]}
              />
            </div>
          </details>
        )}
      </section>
      <details className="mb-6 rounded-2xl border bg-white p-6">
        <summary className="cursor-pointer text-lg font-semibold">
          Estado del negocio
        </summary>
        <p className="text-muted-foreground my-4 text-sm">
          Suspender o archivar oculta el negocio a sus miembros y a visitantes.
          Los datos se conservan y podés reactivarlo. Para conservar acceso del
          propietario al historial, pausá la suscripción en la sección anterior.
        </p>
        <ActionForm
          action={saveOrganizationStatusAction.bind(null, org)}
          submitLabel="Actualizar estado del negocio"
          fields={[
            {
              name: "status",
              label: "Estado",
              type: "select",
              value: o.status,
              options: [
                { value: "active", label: "Activo" },
                { value: "suspended", label: "Suspendido" },
                { value: "archived", label: "Archivado" },
              ],
            },
            { name: "reason", label: "Motivo", required: true, maxLength: 300 },
          ]}
        />
      </details>
      <section className="mb-6 rounded-2xl border bg-white p-6">
        <h2 className="mb-4 text-xl font-semibold">Feedback del piloto</h2>
        <ul className="space-y-4">
          {feedback.map((f) => (
            <li key={f.id} className="rounded-xl border p-4 text-sm leading-6">
              <p className="font-medium">
                {formatTimestamp(f.created_at, o.timezone)}
              </p>
              <p>
                Dificultad: {f.difficulty}/5 · Valor: {f.perceived_value}/5 ·
                Pagaría:{" "}
                {(
                  { yes: "Sí", no: "No", unknown: "Todavía no sabe" } as Record<
                    string,
                    string
                  >
                )[f.willing_to_pay] ?? f.willing_to_pay}
              </p>
              {[
                ["Problemas", f.problems],
                ["Funciones", f.requests],
                ["Sugerencias", f.suggestions],
              ]
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <p className="mt-2 break-words whitespace-pre-wrap" key={k}>
                    <strong>{k}:</strong> {v}
                  </p>
                ))}
            </li>
          ))}
        </ul>
        {!feedback.length && (
          <p className="text-muted-foreground text-sm">
            Todavía no recibiste feedback de este negocio.
          </p>
        )}
        <p className="text-muted-foreground mt-3 text-xs">Últimos 20 envíos.</p>
      </section>
      <section>
        <h2 className="mb-4 text-xl font-semibold">
          Últimos cambios del negocio
        </h2>
        <AuditList entries={audit} />
      </section>
    </>
  );
}
