import type { PublicReceipt } from "@/features/public-booking/schema";
import { formatMoney } from "@/lib/utils/money";
import {
  localDay,
  localTime,
  statusLabels,
} from "@/features/appointments/presentation";
export function BookingReceipt({ receipt }: { receipt: PublicReceipt }) {
  return (
    <section className="space-y-5 rounded-2xl border bg-white p-6 md:p-8">
      <div>
        <p className="text-primary mb-2 text-xs font-medium tracking-wider uppercase">
          {statusLabels[receipt.status]}
        </p>
        <h1 className="text-2xl font-semibold break-words">
          {receipt.service_name}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {receipt.organization_name}
        </p>
      </div>
      <dl className="grid gap-5 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Fecha y hora</dt>
          <dd className="mt-2 font-medium">
            {localDay(receipt.timezone, new Date(receipt.starts_at))} ·{" "}
            {localTime(receipt.starts_at, receipt.timezone)}
          </dd>
          <dd className="text-muted-foreground mt-1 text-xs">
            {receipt.timezone}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Profesional</dt>
          <dd className="mt-2 break-words">{receipt.staff_name}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">A nombre de</dt>
          <dd className="mt-2 break-words">{receipt.customer_name}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Precio acordado</dt>
          <dd className="mt-2">
            {formatMoney(receipt.price_minor, receipt.currency)}{" "}
            {receipt.currency}
          </dd>
          <dd className="text-muted-foreground mt-1 text-xs">
            No se registró ningún pago online.
          </dd>
        </div>
      </dl>
      {receipt.status === "pending" && (
        <p role="status" className="bg-muted rounded-xl p-4 text-sm leading-6">
          El negocio recibió tu solicitud y tiene que confirmarla. Guardá tu
          enlace de gestión para consultar el estado. Si el negocio tiene
          habilitados los avisos, también podrá notificarte por email.
        </p>
      )}
      <div className="border-t pt-4">
        <h2 className="text-sm font-semibold">Cancelaciones y cambios</h2>
        <p className="mt-2 text-sm leading-6 break-words whitespace-pre-wrap">
          {receipt.cancellation_policy}
        </p>
        <p className="text-muted-foreground mt-2 text-xs leading-5">
          Cambios online hasta {receipt.cancellation_notice_minutes} minutos
          antes del comienzo.{" "}
          {receipt.contact_email && `Contacto: ${receipt.contact_email}. `}
          {receipt.contact_phone}
        </p>
      </div>
    </section>
  );
}
