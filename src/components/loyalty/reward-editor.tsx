import { ActionForm } from "@/components/ui/action-form";
import { saveLoyaltyRewardAction } from "@/features/loyalty/actions";
import { localDay, lastDay } from "@/features/subscriptions/presentation";
import type { LoyaltyReward } from "@/features/loyalty/schema";
export function RewardEditor({
  org,
  mode,
  zone,
  startsOn,
  endsOn,
  reward,
}: {
  org: string;
  mode: "visits" | "points";
  zone: string;
  startsOn: string;
  endsOn: string;
  reward?: LoyaltyReward;
}) {
  const unit = mode === "visits" ? "visitas" : "puntos";
  return (
    <ActionForm
      requiresModule="loyalty"
      key={reward?.version ?? "new"}
      action={saveLoyaltyRewardAction.bind(
        null,
        org,
        reward?.id ?? null,
        reward?.version ?? null,
      )}
      submitLabel={reward ? "Guardar recompensa" : "Crear recompensa"}
      fields={[
        {
          name: "name",
          label: "Nombre de la recompensa",
          value: reward?.name,
          required: true,
          maxLength: 100,
        },
        {
          name: "benefit",
          label: "Beneficio que entrega el negocio",
          type: "textarea",
          value: reward?.benefit,
          required: true,
          maxLength: 2000,
          hint: "Ejemplo editable: servicio adicional, descuento o beneficio personalizado. El sistema registra el canje; no modifica cobros ni reservas.",
        },
        {
          name: "cost",
          label: `Cantidad de ${unit} necesaria`,
          type: "number",
          value: String(reward?.cost ?? 10),
          required: true,
          min: 1,
          max: 1000000,
          hint:
            mode === "visits"
              ? "Este es el objetivo de visitas para esta recompensa."
              : "Los puntos son unidades del programa, sin equivalencia monetaria.",
        },
        {
          name: "conditions",
          label: "Condiciones del canje",
          type: "textarea",
          value: reward?.conditions ?? "",
          maxLength: 2000,
        },
        {
          name: "starts_on",
          label: "Primer día de vigencia",
          type: "date",
          value: reward ? localDay(reward.starts_at, zone) : startsOn,
          required: true,
        },
        {
          name: "ends_on",
          label: "Último día de vigencia (inclusive)",
          type: "date",
          value: reward ? lastDay(reward.ends_at, zone) : endsOn,
          required: true,
        },
        {
          name: "per_customer_limit",
          label: "Máximo de canjes por cliente",
          type: "number",
          value: reward?.per_customer_limit
            ? String(reward.per_customer_limit)
            : "",
          min: 1,
          max: 10000,
          hint: "Vacío: sin límite. Cuenta todos los canjes de esta recompensa que no fueron anulados.",
        },
        {
          name: "total_limit",
          label: "Máximo de canjes entre todos los clientes",
          type: "number",
          value: reward?.total_limit ? String(reward.total_limit) : "",
          min: 1,
          max: 1000000,
          hint: "Vacío: sin límite. Los canjes anulados liberan cupo.",
        },
        {
          name: "is_active",
          label: "Habilitar recompensa",
          type: "checkbox",
          value: reward?.is_active ?? true,
        },
      ]}
    />
  );
}
