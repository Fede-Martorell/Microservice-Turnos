import { PublicShell } from "@/components/public-booking/public-shell";
import { AccessExchange } from "@/components/public-booking/access-exchange";
import { DigitalCard } from "@/components/loyalty/digital-card";
import { Button } from "@/components/ui/button";
import { loadLoyaltyCard } from "@/features/loyalty/queries";
import { closeLoyaltyCard } from "@/features/loyalty/card-actions";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Mi tarjeta de beneficios",
  robots: { index: false, follow: false },
};
export default async function CardPage() {
  const result = await loadLoyaltyCard();
  return (
    <PublicShell>
      <AccessExchange
        key={crypto.randomUUID()}
        hasReceipt={Boolean(result.value)}
        path="/tarjeta"
        endpoint="/api/loyalty/access"
      >
        {result.value ? (
          <>
            <DigitalCard card={result.value} />
            <form action={closeLoyaltyCard} className="mx-auto mt-6 max-w-2xl">
              <Button variant="outline" type="submit">
                Salir de esta tarjeta
              </Button>
            </form>
          </>
        ) : (
          <section className="mx-auto max-w-xl rounded-2xl border bg-white p-6">
            <h1 className="text-2xl font-semibold">Tu tarjeta privada</h1>
            <p className="text-muted-foreground mt-4 text-sm leading-6">
              {result.code === "offline"
                ? "No pudimos conectar. Volvé a abrir el enlace para intentar nuevamente."
                : "El enlace no está disponible, venció o fue revocado. Pedí al negocio un enlace nuevo para tu tarjeta."}
            </p>
          </section>
        )}
      </AccessExchange>
    </PublicShell>
  );
}
