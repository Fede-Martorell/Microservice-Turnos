import { ActionForm } from "@/components/ui/action-form";
import type { FormField } from "@/components/ui/action-form";
import {
  loadPlanCatalog,
  loadTrialPolicy,
  requirePlatformAdmin,
} from "@/features/subscriptions/queries";
import {
  savePlanAction,
  saveTrialPolicyAction,
  saveModulePriceAction,
} from "@/features/subscriptions/actions";
import { priceInput, formatMoney } from "@/lib/utils/money";
import type { Plan, Module } from "@/types/subscriptions";
export const metadata = { title: "Planes y pruebas" };
function fields(
  modules: Module[],
  plan?: Plan,
  enabled: string[] = [],
): FormField[] {
  return [
    ...(!plan
      ? [
          {
            name: "code",
            label: "Código único",
            required: true,
            maxLength: 40,
            pattern: "[a-z][a-z0-9_-]{1,39}",
            hint: "Minúsculas, números, guion o guion bajo. No se puede cambiar después.",
          },
        ]
      : []),
    {
      name: "name",
      label: "Nombre",
      value: plan?.name,
      required: true,
      maxLength: 80,
    },
    {
      name: "description",
      label: "Descripción",
      type: "textarea",
      value: plan?.description,
      maxLength: 1000,
    },
    {
      name: "currency",
      label: "Moneda de referencia (ISO)",
      value: plan?.currency ?? "USD",
      required: true,
      pattern: "[A-Z]{3}",
    },
    {
      name: "price",
      label: "Precio mensual de referencia",
      value: plan ? priceInput(plan.price_minor, plan.currency) : "0",
      required: true,
      hint: "Sin separador de miles. No genera cargos.",
    },
    {
      name: "max_professionals",
      label: "Máximo de profesionales activos",
      type: "number",
      value: String(plan?.max_professionals ?? 1),
      required: true,
      min: 1,
      max: 1000,
    },
    {
      name: "modules",
      label: "Módulos incluidos",
      type: "checklist",
      value: enabled,
      options: modules
        .filter((m) => m.is_available)
        .map((m) => ({ value: m.code, label: m.name })),
      hint: "Agenda y reservas es obligatorio. Los cambios afectan los accesos asignados a este plan.",
    },
    {
      name: "is_active",
      label: "Disponible para nuevas asignaciones manuales",
      type: "checkbox",
      value: plan?.is_active ?? true,
      hint: "La política de pruebas de nuevos negocios se configura por separado. Cambiala antes de retirar su plan inicial.",
    },
  ];
}
export default async function PlansPage() {
  await requirePlatformAdmin();
  const [catalog, policy] = await Promise.all([
    loadPlanCatalog(),
    loadTrialPolicy(),
  ]);
  const options = catalog.plans
    .filter((p) => p.is_active || p.code === policy.default_plan_code)
    .map((p) => ({
      value: p.code,
      label:
        p.name + (p.is_active ? "" : " (inactivo: elegí otro para guardar)"),
    }));
  return (
    <>
      <h1 className="text-3xl font-semibold">Planes y pruebas</h1>
      <p className="text-muted-foreground my-4 text-sm leading-6">
        Precios de referencia editables. No hay pasarela de pago ni cobros
        automáticos. Bajar el cupo de un plan conserva los profesionales
        existentes y bloquea nuevas altas mientras superen el límite.
      </p>
      <section className="my-6 rounded-2xl border bg-white p-6">
        <h2 className="mb-4 text-xl font-semibold">
          Prueba de nuevos negocios
        </h2>
        <ActionForm
          action={saveTrialPolicyAction}
          submitLabel="Guardar política"
          fields={[
            {
              name: "plan",
              label: "Plan inicial",
              type: "select",
              value: policy.default_plan_code,
              options,
              required: true,
            },
            {
              name: "days",
              label: "Duración en días",
              type: "number",
              value: String(policy.trial_days),
              min: 1,
              max: 180,
              required: true,
            },
          ]}
        />
        <p className="text-muted-foreground mt-3 text-xs">
          Aplica a los negocios creados después de guardar.
        </p>
      </section>
      <div className="space-y-5">
        {catalog.plans.map((plan) => (
          <details className="rounded-2xl border bg-white p-6" key={plan.code}>
            <summary className="cursor-pointer text-lg font-semibold">
              {plan.name} · {formatMoney(plan.price_minor, plan.currency)} ·{" "}
              {plan.max_professionals} profesionales{" "}
              {plan.is_active ? "" : "· No disponible"}
            </summary>
            <div className="mt-6">
              <ActionForm
                key={`${plan.code}-${plan.version}`}
                action={savePlanAction.bind(null, plan.code, plan.version)}
                submitLabel="Guardar plan"
                fields={fields(
                  catalog.modules,
                  plan,
                  catalog.entitlements
                    .filter((e) => e.plan_code === plan.code)
                    .map((e) => e.module_code),
                )}
              />
            </div>
          </details>
        ))}
      </div>
      <details className="mt-6 rounded-2xl border bg-white p-6">
        <summary className="cursor-pointer text-lg font-semibold">
          Crear plan
        </summary>
        <div className="mt-5">
          <ActionForm
            action={savePlanAction.bind(null, null, null)}
            submitLabel="Crear plan"
            resetOnSuccess
            fields={fields(catalog.modules, undefined, ["bookings"])}
          />
        </div>
      </details>
      <section className="mt-6 rounded-2xl border bg-white p-6">
        <h2 className="mb-4 text-xl font-semibold">
          Referencias de complementos
        </h2>
        <p className="text-muted-foreground mb-4 text-sm">
          Referencias mensuales editables, sin cargos. Cambiar un precio no
          habilita el módulo ni lo agrega a un plan. La fidelización se puede
          habilitar individualmente desde el negocio → Excepciones de módulos.
        </p>
        {catalog.modules
          .filter(
            (m) =>
              typeof m.reference_price_minor === "number" &&
              (m.reference_price_minor > 0 || m.code === "loyalty"),
          )
          .map((m) => (
            <details className="mb-4 rounded-xl border p-4" key={m.code}>
              <summary className="cursor-pointer break-words">
                {m.name} ·{" "}
                {formatMoney(m.reference_price_minor, m.reference_currency)}
                {m.is_available ? "" : " · Próximamente"}
              </summary>
              <div className="mt-4">
                <ActionForm
                  action={saveModulePriceAction.bind(null, m.code)}
                  submitLabel="Guardar referencia del complemento"
                  fields={[
                    {
                      name: "price",
                      label: "Precio mensual de referencia",
                      value: priceInput(
                        m.reference_price_minor,
                        m.reference_currency,
                      ),
                      required: true,
                    },
                    {
                      name: "currency",
                      label: "Moneda ISO",
                      value: m.reference_currency,
                      pattern: "[A-Z]{3}",
                      required: true,
                    },
                  ]}
                />
              </div>
            </details>
          ))}
      </section>
      <p className="text-muted-foreground mt-6 text-sm">
        Módulos futuros:{" "}
        {catalog.modules
          .filter((m) => !m.is_available)
          .map((m) => m.name)
          .join(", ")}
        . No se pueden habilitar todavía.
      </p>
    </>
  );
}
