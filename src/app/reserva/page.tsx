import {
  loadPublicReceipt,
  loadRescheduleSlots,
  publicMessages,
} from "@/features/public-booking/queries";
import { PublicShell } from "@/components/public-booking/public-shell";
import { AccessExchange } from "@/components/public-booking/access-exchange";
import { BookingReceipt } from "@/components/public-booking/receipt";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import {
  managePublicAction,
  closePublicBooking,
} from "@/features/public-booking/actions";
import { localDay, localTime } from "@/features/appointments/presentation";
import { z } from "zod";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Gestionar mi reserva",
  robots: { index: false, follow: false },
};
export default async function ManagePage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string | string[] }>;
}) {
  const result = await loadPublicReceipt();
  const receipt = result.value;
  const query = await searchParams;
  const day = z.iso.date().safeParse(query.fecha).success
    ? String(query.fecha)
    : localDay(
        receipt?.timezone ?? "UTC",
        receipt ? new Date(receipt.starts_at) : new Date(),
      );
  const slots = receipt?.can_manage ? await loadRescheduleSlots(day) : null;
  return (
    <PublicShell>
      <AccessExchange key={crypto.randomUUID()} hasReceipt={Boolean(receipt)}>
        {receipt ? (
          <div className="mx-auto max-w-2xl space-y-6">
            <BookingReceipt receipt={receipt} />
            {receipt.can_manage ? (
              <>
                <section className="space-y-5 rounded-2xl border bg-white p-6">
                  <h2 className="text-lg font-semibold">
                    Reprogramar mi turno
                  </h2>
                  <p className="text-muted-foreground text-sm leading-6">
                    Se conserva el servicio, profesional y precio acordados.
                    Elegí la fecha y un horario disponible.
                  </p>
                  <form className="flex flex-wrap items-end gap-3">
                    <div>
                      <label
                        htmlFor="manage-date"
                        className="mb-2 block text-sm"
                      >
                        Nueva fecha
                      </label>
                      <input
                        id="manage-date"
                        name="fecha"
                        type="date"
                        defaultValue={day}
                        required
                        className="min-h-12 min-w-0 rounded-lg border px-3 text-base"
                      />
                    </div>
                    <Button
                      type="submit"
                      variant="outline"
                      className="min-h-12"
                    >
                      Consultar horarios
                    </Button>
                  </form>
                  {slots?.value?.length ? (
                    <ActionForm
                      key={`${receipt.version}-${day}`}
                      action={managePublicAction.bind(
                        null,
                        "reschedule",
                        receipt.version,
                      )}
                      fields={[
                        {
                          name: "starts_at",
                          label: `Horario para ${day}`,
                          type: "select",
                          value: slots.value[0]!.starts_at,
                          options: slots.value.map((slot) => ({
                            value: slot.starts_at,
                            label: localTime(slot.starts_at, receipt.timezone),
                          })),
                        },
                      ]}
                      submitLabel="Guardar nuevo horario"
                    />
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      {slots?.code === "ok"
                        ? "No hay horarios disponibles para esta fecha."
                        : (publicMessages[slots?.code ?? ""] ??
                          "No pudimos consultar los horarios.")}
                    </p>
                  )}
                </section>
                <section className="space-y-4 rounded-2xl border bg-white p-6">
                  <h2 className="text-lg font-semibold">Cancelar mi turno</h2>
                  <p className="text-muted-foreground text-sm leading-6">
                    Al confirmar la cancelación se libera el horario. Esta
                    operación no se puede deshacer desde el enlace.
                  </p>
                  <ActionForm
                    action={managePublicAction.bind(
                      null,
                      "cancel",
                      receipt.version,
                    )}
                    fields={[
                      {
                        name: "confirm_cancel",
                        label: "Quiero cancelar esta reserva",
                        type: "checkbox",
                        required: true,
                      },
                    ]}
                    submitLabel="Confirmar cancelación"
                  />
                </section>
              </>
            ) : (
              <p
                role="status"
                className="rounded-xl border bg-white p-5 text-sm leading-6"
              >
                {receipt.status === "canceled"
                  ? "Tu reserva está cancelada."
                  : "Esta reserva ya no admite cambios online. Si necesitás ayuda, comunicate con el negocio."}
              </p>
            )}
            <form action={closePublicBooking}>
              <Button variant="outline" type="submit" className="min-h-11">
                Cerrar acceso a esta reserva
              </Button>
            </form>
          </div>
        ) : (
          <section className="mx-auto max-w-lg rounded-2xl border bg-white p-7">
            <h1 className="text-2xl font-semibold">Gestionar mi reserva</h1>
            <p className="text-muted-foreground mt-4 text-sm leading-7">
              {result.code === "not_found"
                ? "Abrí el enlace privado que recibiste al reservar. Si venció o fue revocado, comunicate con el negocio."
                : (publicMessages[result.code] ??
                  "No pudimos consultar tu reserva. Intentá nuevamente.")}
            </p>
          </section>
        )}
      </AccessExchange>
    </PublicShell>
  );
}
