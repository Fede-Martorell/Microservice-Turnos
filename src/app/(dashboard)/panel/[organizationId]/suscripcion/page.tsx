import { notFound } from "next/navigation";
import { OrganizationScreen } from "@/components/layout/organization-screen";
import { ActionForm } from "@/components/ui/action-form";
import { requireOrganization } from "@/features/organizations/queries";
import {
  getOrganizationAccess,
  loadPlanCatalog,
} from "@/features/subscriptions/queries";
import { saveFeedbackAction } from "@/features/subscriptions/actions";
import { subscriptionStatuses } from "@/features/subscriptions/schema";
import { periodText } from "@/features/subscriptions/presentation";
import { formatMoney } from "@/lib/utils/money";
export const metadata = { title: "Suscripción" };
export default async function SubscriptionPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId: org } = await params;
  const context = await requireOrganization(org);
  if (context.role !== "owner") notFound();
  const [access, catalog] = await Promise.all([
    getOrganizationAccess(org),
    loadPlanCatalog(),
  ]);
  const { subscription: s, plan } = access;
  const rating = [1, 2, 3, 4, 5].map((v) => ({
    value: String(v),
    label: String(v),
  }));
  return (
    <OrganizationScreen organizationId={org}>
      <h1 className="text-3xl font-semibold">Suscripción</h1>
      <section className="my-6 space-y-3 rounded-2xl border bg-white p-6">
        <h2 className="text-xl font-semibold">
          {plan.name} · {subscriptionStatuses[s.status]}
        </h2>
        <p className="text-sm">
          Período:{" "}
          {periodText(s.starts_at, s.ends_at, context.organization.timezone)}.
        </p>
        <p className="text-sm">
          Profesionales activos: {access.active_professionals} de{" "}
          {plan.max_professionals}.
        </p>
        <p className="text-sm">
          Referencia mensual actual:{" "}
          {formatMoney(plan.price_minor, plan.currency)}. Referencia registrada
          al asignar el acceso:{" "}
          {formatMoney(s.quoted_price_minor, s.quoted_currency)}.
        </p>
        <p className="text-muted-foreground text-sm">
          Los pilotos y pruebas son gratuitos. Esta pantalla no realiza cobros
          ni renovaciones automáticas. Coordiná los cambios de plan con la
          administración.
        </p>
        {!access.can_write && (
          <p className="text-sm">
            El acceso está inactivo. Los datos se conservan; podés consultar el
            historial y cancelar turnos existentes.
          </p>
        )}
      </section>
      <section className="mb-6 rounded-2xl border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">
          Módulos de tu acceso actual
        </h2>
        <ul className="grid gap-3 md:grid-cols-2">
          {catalog.modules.map((m) => (
            <li key={m.code} className="rounded-lg border p-3 text-sm">
              <span className="font-medium">{m.name}</span>
              <p>
                {!m.is_available
                  ? "Próximamente"
                  : access.modules.includes(m.code)
                    ? "Habilitado"
                    : "Sin acceso actual"}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                {m.description}
              </p>
              {m.reference_price_minor > 0 && (
                <p className="mt-2 text-xs">
                  Referencia del complemento:{" "}
                  {formatMoney(m.reference_price_minor, m.reference_currency)}
                  /mes. No se realizan cargos.
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>
      {["pilot", "trial"].includes(s.status) && (
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="mb-2 text-lg font-semibold">
            Contanos cómo va el piloto
          </h2>
          <p className="text-muted-foreground mb-5 text-sm">
            Hasta 5 envíos por día. Evitá incluir datos personales de clientes.
          </p>
          <ActionForm
            action={saveFeedbackAction.bind(null, org)}
            requiresModule={false}
            resetOnSuccess
            submitLabel="Enviar feedback"
            fields={[
              {
                name: "problems",
                label: "Problemas encontrados",
                type: "textarea",
                maxLength: 1500,
              },
              {
                name: "difficulty",
                label: "Dificultad de uso (1: fácil, 5: difícil)",
                type: "select",
                value: "1",
                options: rating,
                required: true,
              },
              {
                name: "requests",
                label: "Funciones que te faltan",
                type: "textarea",
                maxLength: 1500,
              },
              {
                name: "perceived_value",
                label: "Valor que aporta (1: poco, 5: mucho)",
                type: "select",
                value: "3",
                options: rating,
                required: true,
              },
              {
                name: "willing_to_pay",
                label: "¿Pagarías por este servicio?",
                type: "select",
                value: "unknown",
                options: [
                  { value: "unknown", label: "Todavía no sé" },
                  { value: "yes", label: "Sí" },
                  { value: "no", label: "No" },
                ],
              },
              {
                name: "suggestions",
                label: "Sugerencias",
                type: "textarea",
                maxLength: 1500,
              },
            ]}
          />
        </section>
      )}
    </OrganizationScreen>
  );
}
