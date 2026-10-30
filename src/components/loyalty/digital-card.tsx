import type { LoyaltyCard } from "@/features/loyalty/schema";
import {
  formatTimestamp,
  periodText,
} from "@/features/subscriptions/presentation";
const labels = {
  earned: "Servicio completado",
  adjustment: "Ajuste del negocio",
  redeemed: "Canje de recompensa",
  refund: "Canje anulado",
};
export function DigitalCard({ card }: { card: LoyaltyCard }) {
  const unit = card.mode === "visits" ? "visitas" : "puntos";
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="border-ink bg-ink rounded-2xl border p-6 text-white sm:p-8">
        <p className="text-xs tracking-wider text-white/70 uppercase">
          Tu tarjeta privada
        </p>
        <h1 className="editorial-title mt-4 text-4xl break-words">
          {card.organization_name}
        </h1>
        <p className="mt-3 text-sm break-words text-white/75">
          {card.program_name}
        </p>
        <p className="my-5 text-4xl font-semibold">
          {card.balance}{" "}
          <span className="text-xl font-normal">{unit} disponibles</span>
        </p>
        {!card.operational && (
          <p className="bg-muted text-foreground rounded-lg p-3 text-sm">
            El programa no admite nuevas acreditaciones ni canjes en este
            momento. Conservás la consulta de tus beneficios e historial.
          </p>
        )}
        {card.expiry.next_expiry && (
          <p className="mt-3 text-sm">
            Próximo vencimiento:{" "}
            {formatTimestamp(card.expiry.next_expiry, card.timezone)}.
          </p>
        )}
        {card.expiry.expired_balance > 0 && (
          <p className="mt-2 text-sm text-white/75">
            {card.expiry.expired_balance} {unit} vencidos sin usar, fuera del
            saldo disponible.
          </p>
        )}
        <p className="mt-4 text-xs text-white/70">
          Los {unit} son unidades de este programa y no representan dinero.
        </p>
      </header>
      <section className="rounded-2xl border bg-white p-6">
        <h2 className="mb-4 text-xl font-semibold">Recompensas y progreso</h2>
        <ul className="space-y-5">
          {card.rewards.map((r, i) => (
            <li
              className="space-y-3 rounded-xl border p-4"
              key={`${r.name}-${i}`}
            >
              <h3 className="font-semibold break-words">{r.name}</h3>
              <p className="text-sm whitespace-pre-wrap">{r.benefit}</p>
              <label className="block text-sm" htmlFor={`reward-progress-${i}`}>
                {Math.min(card.balance, r.cost)} de {r.cost} {unit}
              </label>
              <progress
                className="loyalty-progress h-2 w-full"
                id={`reward-progress-${i}`}
                max={r.cost}
                value={Math.min(card.balance, r.cost)}
              />
              <p className="text-sm font-medium">
                {r.available
                  ? "Disponible para coordinar con el negocio"
                  : "Pendiente de saldo, vigencia o cupo"}
              </p>
              <p className="text-muted-foreground text-xs">
                {periodText(r.starts_at, r.ends_at, card.timezone)}
              </p>
              {r.conditions && (
                <p className="text-muted-foreground text-xs whitespace-pre-wrap">
                  {r.conditions}
                </p>
              )}
            </li>
          ))}
        </ul>
        {!card.rewards.length && (
          <p className="text-muted-foreground text-sm">
            El negocio todavía no publicó recompensas.
          </p>
        )}
        <p className="text-muted-foreground mt-5 text-sm">
          Coordiná el canje con el negocio: su propietario registra la entrega
          del beneficio.
        </p>
      </section>
      <section className="rounded-2xl border bg-white p-6">
        <h2 className="mb-4 text-xl font-semibold">Condiciones</h2>
        <p className="text-sm leading-6 whitespace-pre-wrap">
          {card.conditions}
        </p>
        <p className="mt-4 text-sm leading-6">
          {card.mode === "visits" && card.reset_mode === "reset"
            ? "Al canjear, el contador vuelve a cero y se consumen también las visitas que superen el objetivo."
            : "Al canjear se resta el costo de la recompensa y conservás el resto del saldo vigente."}
        </p>
        <p className="text-muted-foreground mt-3 text-sm">
          {card.expire_days
            ? `Las nuevas acreditaciones vencen a los ${card.expire_days} días. Cada crédito anterior conserva la vigencia con la que fue otorgado.`
            : "Las nuevas acreditaciones no tienen vencimiento. Los créditos anteriores conservan sus condiciones originales."}
        </p>
      </section>
      <section className="rounded-2xl border bg-white p-6">
        <h2 className="mb-4 text-xl font-semibold">Últimos movimientos</h2>
        <p className="text-muted-foreground mb-4 text-xs">
          Anular un canje conserva los vencimientos originales: los créditos ya
          vencidos no vuelven al saldo disponible.
        </p>
        <ol className="space-y-4">
          {card.history.map((t, i) => (
            <li className="border-t pt-3 text-sm" key={`${t.created_at}-${i}`}>
              <div className="flex flex-wrap justify-between gap-3">
                <p>{labels[t.kind]}</p>
                <strong>
                  {t.amount > 0 ? "+" : ""}
                  {t.amount} {unit}
                </strong>
              </div>
              {t.service_name && (
                <p className="mt-1 break-words">{t.service_name}</p>
              )}
              <p className="text-muted-foreground mt-1 text-xs">
                {formatTimestamp(t.created_at, card.timezone)}
              </p>
              {t.expires_at && (
                <p className="text-muted-foreground mt-1 text-xs">
                  Vencimiento del crédito:{" "}
                  {formatTimestamp(t.expires_at, card.timezone)}
                </p>
              )}
            </li>
          ))}
        </ol>
        {!card.history.length && (
          <p className="text-muted-foreground text-sm">
            Tu primer movimiento aparecerá al completar un servicio
            participante.
          </p>
        )}
        <p className="text-muted-foreground mt-4 text-xs">
          Se muestran los últimos 20 movimientos. Para consultas sobre los
          anteriores, contactá al negocio.
        </p>
      </section>
    </div>
  );
}
