import Link from "next/link";
import { z } from "zod";
import { OrganizationScreen } from "@/components/layout/organization-screen";
import { ActionForm } from "@/components/ui/action-form";
import {
  loadLoyaltyConfig,
  loadLoyaltyCustomer,
} from "@/features/loyalty/queries";
import {
  adjustLoyaltyAction,
  redeemLoyaltyAction,
  voidLoyaltyAction,
  issueLoyaltyCardAction,
  revokeLoyaltyCardAction,
} from "@/features/loyalty/actions";
import { formatTimestamp } from "@/features/subscriptions/presentation";
export const metadata = { title: "Tarjeta del cliente" };
const labels = {
  earned: "Servicio completado",
  adjustment: "Ajuste",
  redeemed: "Canje",
  refund: "Canje anulado",
};
export default async function LoyaltyCustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string; customerId: string }>;
  searchParams: Promise<{ pagina?: string }>;
}) {
  const { organizationId: org, customerId: id } = await params;
  const page = z.coerce
    .number()
    .int()
    .min(0)
    .max(2000)
    .catch(0)
    .parse((await searchParams).pagina ?? 0);
  const [config, data] = await Promise.all([
    loadLoyaltyConfig(org),
    loadLoyaltyCustomer(org, id, page),
  ]);
  const zone = data.context.organization.timezone;
  const unit = config.program?.mode === "points" ? "puntos" : "visitas";
  const base = `/panel/${org}/fidelizacion`;
  return (
    <OrganizationScreen organizationId={org}>
      <div className="mb-5 flex flex-wrap gap-5 text-sm underline">
        <Link href={base}>← Fidelización</Link>
        <Link href={`/panel/${org}/clientes/${id}`}>Ficha del cliente</Link>
      </div>
      <h1 className="text-3xl font-semibold break-words">
        {data.customer.name}
      </h1>
      {!config.program ? (
        <p className="my-6 rounded-xl border bg-white p-6">
          Primero{" "}
          <Link className="text-primary underline" href={`${base}/configurar`}>
            configurá un programa
          </Link>{" "}
          para este negocio.
        </p>
      ) : (
        <>
          <section className="my-6 rounded-2xl border bg-white p-6">
            <h2 className="text-lg font-semibold">{config.program.name}</h2>
            <p className="mt-3 text-3xl font-semibold">
              {data.balance} {unit} disponibles
            </p>
            {data.expiry.next_expiry && (
              <p className="mt-3 text-sm">
                Próximo vencimiento de créditos:{" "}
                {formatTimestamp(data.expiry.next_expiry, zone)}.
              </p>
            )}
            {data.expiry.expired_balance > 0 && (
              <p className="text-muted-foreground mt-2 text-sm">
                {data.expiry.expired_balance} {unit} vencidos sin usar, fuera
                del saldo disponible.
              </p>
            )}
            {!data.can_redeem && (
              <p className="text-muted-foreground mt-3 text-sm">
                Los canjes requieren programa y acceso vigentes, y cliente
                activo. El historial se conserva.
              </p>
            )}
          </section>
          <div className="grid items-start gap-6 xl:grid-cols-2">
            <div className="space-y-6">
              <section className="rounded-2xl border bg-white p-6">
                <h2 className="mb-3 text-xl font-semibold">Registrar canje</h2>
                <p className="text-muted-foreground mb-5 text-sm">
                  Comprobá que el cliente recibe el beneficio. El registro
                  consume saldo y no aplica descuentos ni modifica reservas
                  automáticamente.
                </p>
                {config.rule?.reset_mode === "reset" &&
                  config.program.mode === "visits" && (
                    <p className="bg-muted mb-5 rounded-lg p-3 text-sm">
                      El programa reinicia el contador: al canjear se consumirán
                      las {data.balance} visitas disponibles, incluidas las que
                      superen el costo.
                    </p>
                  )}
                <ul className="space-y-4">
                  {config.rewards
                    .filter((r) => r.is_active)
                    .map((r) => (
                      <li className="rounded-xl border p-4" key={r.id}>
                        <h3 className="font-semibold break-words">{r.name}</h3>
                        <p className="mt-2 text-sm">
                          {r.cost} {unit}
                        </p>
                        <p className="my-3 text-sm whitespace-pre-wrap">
                          {r.benefit}
                        </p>
                        <p className="text-muted-foreground mb-3 text-xs whitespace-pre-wrap">
                          {r.conditions}
                        </p>
                        {data.can_redeem &&
                        data.available_rewards.includes(r.id) &&
                        data.balance >= r.cost ? (
                          <ActionForm
                            key={`${r.id}-${r.version}-${data.balance}`}
                            requiresModule="loyalty"
                            action={redeemLoyaltyAction.bind(
                              null,
                              org,
                              id,
                              r.id,
                              r.version,
                            )}
                            fields={[
                              {
                                name: "request_key",
                                label: "Solicitud",
                                type: "hidden",
                                value: crypto.randomUUID(),
                              },
                            ]}
                            submitLabel={`Canjear ${r.name}`}
                          />
                        ) : (
                          <p className="text-muted-foreground text-sm">
                            No disponible por saldo, vigencia o límite de uso.
                          </p>
                        )}
                      </li>
                    ))}
                </ul>
                {!config.rewards.some((r) => r.is_active) && (
                  <p className="text-muted-foreground text-sm">
                    No hay recompensas habilitadas.
                  </p>
                )}
              </section>
              <section className="space-y-4 rounded-2xl border bg-white p-6">
                <h2 className="text-xl font-semibold">
                  Tarjeta digital privada
                </h2>
                <p className="text-muted-foreground text-sm">
                  El cliente consulta saldo, recompensas y últimos movimientos.
                  El enlace vence a los 90 días; emitir uno nuevo invalida el
                  anterior. Compartilo únicamente con este cliente. No se envía
                  un email.
                </p>
                {data.card && (
                  <p className="text-sm">
                    {data.card.revoked ? "Enlace revocado" : "Enlace emitido"} ·
                    Vence {formatTimestamp(data.card.expires_at, zone)}
                  </p>
                )}
                {data.customer.is_active && (
                  <ActionForm
                    requiresModule="loyalty"
                    action={issueLoyaltyCardAction.bind(null, org, id)}
                    fields={[]}
                    submitLabel="Emitir nuevo enlace de tarjeta"
                    linkLabel="Enlace privado de la tarjeta"
                    linkHint="Copiá este enlace para el cliente. Vence en 90 días; emitir otro revoca este. Se muestra solo en esta respuesta."
                  />
                )}
                {data.card && !data.card.revoked && (
                  <ActionForm
                    requiresModule={false}
                    action={revokeLoyaltyCardAction.bind(null, org, id)}
                    fields={[]}
                    submitLabel="Revocar enlace de tarjeta"
                  />
                )}
              </section>
              <details className="rounded-2xl border bg-white p-6">
                <summary className="cursor-pointer text-lg font-semibold">
                  Ajuste compensatorio
                </summary>
                <p className="text-muted-foreground my-4 text-sm leading-6">
                  Usalo para corregir errores con un motivo verificable. Un
                  número positivo suma; uno negativo consume créditos vigentes.
                  No se modifican movimientos anteriores. Si el saldo no
                  alcanza, revisá los canjes y anulá el incorrecto antes de
                  ajustar. Los créditos nuevos usan el vencimiento actual del
                  programa, incluso si está pausado.
                </p>
                <ActionForm
                  key={`${data.balance}-${data.transactions[0]?.id ?? "empty"}`}
                  requiresModule="loyalty"
                  action={adjustLoyaltyAction.bind(null, org, id)}
                  submitLabel="Registrar ajuste"
                  fields={[
                    {
                      name: "amount",
                      label: "Cantidad del ajuste (positiva o negativa)",
                      type: "number",
                      min: -1000000,
                      max: 1000000,
                      required: true,
                    },
                    {
                      name: "reason",
                      label: "Motivo del ajuste",
                      type: "textarea",
                      required: true,
                      maxLength: 300,
                      hint: "De 5 a 300 caracteres; evitá datos personales innecesarios.",
                    },
                    {
                      name: "reference",
                      label: "Movimiento relacionado (opcional)",
                      type: "select",
                      value: "",
                      options: [
                        { value: "", label: "Sin referencia" },
                        ...data.transactions.map((t) => ({
                          value: t.id,
                          label: `${formatTimestamp(t.created_at, zone)} · ${labels[t.kind]} · ${t.amount}`,
                        })),
                      ],
                    },
                    {
                      name: "request_key",
                      label: "Solicitud",
                      type: "hidden",
                      value: crypto.randomUUID(),
                    },
                  ]}
                />
              </details>
            </div>
            <div className="space-y-6">
              <section className="rounded-2xl border bg-white p-6">
                <h2 className="mb-5 text-xl font-semibold">
                  Historial de movimientos
                </h2>
                <ol className="space-y-4">
                  {data.transactions.map((t) => (
                    <li className="border-t pt-4 text-sm leading-6" key={t.id}>
                      <div className="flex flex-wrap justify-between gap-3">
                        <strong>{labels[t.kind]}</strong>
                        <strong>
                          {t.amount > 0 ? "+" : ""}
                          {t.amount} {unit}
                        </strong>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {formatTimestamp(t.created_at, zone)}
                        {t.rule_version ? ` · Reglas v${t.rule_version}` : ""}
                      </p>
                      {t.service_name && <p>{t.service_name}</p>}
                      {t.reason && (
                        <p className="break-words whitespace-pre-wrap">
                          {t.reason}
                        </p>
                      )}
                      {t.expires_at && (
                        <p className="text-muted-foreground text-xs">
                          Vencimiento del crédito:{" "}
                          {formatTimestamp(t.expires_at, zone)}
                        </p>
                      )}
                      {t.appointment_id && (
                        <Link
                          className="text-primary inline-flex min-h-11 items-center text-xs underline"
                          href={`/panel/${org}/reservas/${t.appointment_id}`}
                        >
                          Ver reserva completada
                        </Link>
                      )}
                    </li>
                  ))}
                </ol>
                {!data.transactions.length && (
                  <p className="text-muted-foreground text-sm">
                    Todavía no hay movimientos. Se acredita al completar un
                    servicio participante durante la vigencia del programa.
                  </p>
                )}
                <nav
                  aria-label="Páginas de movimientos"
                  className="mt-5 flex gap-5 text-sm underline"
                >
                  {page > 0 && (
                    <Link href={`${base}/clientes/${id}?pagina=${page - 1}`}>
                      Anterior
                    </Link>
                  )}
                  {data.transactions.length === 50 && page < 2000 && (
                    <Link href={`${base}/clientes/${id}?pagina=${page + 1}`}>
                      Siguiente
                    </Link>
                  )}
                </nav>
              </section>
              <section className="rounded-2xl border bg-white p-6">
                <h2 className="mb-5 text-xl font-semibold">Últimos canjes</h2>
                <ul className="space-y-4">
                  {data.redemptions.map((r) => (
                    <li
                      className="space-y-3 rounded-xl border p-4 text-sm"
                      key={r.id}
                    >
                      <p className="font-semibold break-words">
                        {r.reward_snapshot.name} ·{" "}
                        {r.voided ? "Anulado" : "Registrado"}
                      </p>
                      <p>
                        {formatTimestamp(r.created_at, zone)} ·{" "}
                        {r.reward_snapshot.consumed} {unit} consumidos
                      </p>
                      <p className="whitespace-pre-wrap">
                        {r.reward_snapshot.benefit}
                      </p>
                      <p className="text-muted-foreground text-xs whitespace-pre-wrap">
                        {r.reward_snapshot.conditions}
                      </p>
                      {!r.voided && (
                        <details>
                          <summary className="cursor-pointer underline">
                            Anular este canje
                          </summary>
                          <p className="text-muted-foreground my-3 text-xs leading-5">
                            Se registran créditos nuevos con la vigencia
                            original. Los que ya vencieron no vuelven al saldo
                            disponible. Anular libera el límite de uso de la
                            recompensa.
                          </p>
                          <ActionForm
                            requiresModule="loyalty"
                            action={voidLoyaltyAction.bind(null, org, r.id)}
                            fields={[
                              {
                                name: "reason",
                                label: "Motivo de anulación",
                                required: true,
                                maxLength: 300,
                              },
                              {
                                name: "request_key",
                                label: "Solicitud",
                                type: "hidden",
                                value: crypto.randomUUID(),
                              },
                            ]}
                            submitLabel="Confirmar anulación del canje"
                          />
                        </details>
                      )}
                    </li>
                  ))}
                </ul>
                {!data.redemptions.length && (
                  <p className="text-muted-foreground text-sm">
                    Sin canjes registrados.
                  </p>
                )}
                <p className="text-muted-foreground mt-4 text-xs">
                  Últimos 20 canjes. El historial de movimientos conserva los
                  anteriores.
                </p>
              </section>
            </div>
          </div>
        </>
      )}
    </OrganizationScreen>
  );
}
