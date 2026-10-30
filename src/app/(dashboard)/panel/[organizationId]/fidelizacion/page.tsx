import Link from "next/link";
import { OrganizationScreen } from "@/components/layout/organization-screen";
import { ActionForm } from "@/components/ui/action-form";
import {
  loadLoyaltyConfig,
  loadLoyaltyAccounts,
} from "@/features/loyalty/queries";
import { setLoyaltyActiveAction } from "@/features/loyalty/actions";
import { getOrganizationAccess } from "@/features/subscriptions/queries";
import { periodText } from "@/features/subscriptions/presentation";
export const metadata = { title: "Fidelización" };
export default async function LoyaltyHome({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { organizationId: org } = await params;
  const q = await searchParams;
  const search = typeof q.q === "string" ? q.q.slice(0, 100) : "";
  const page =
    typeof q.pagina === "string" && /^\d{1,4}$/.test(q.pagina)
      ? Math.min(Number(q.pagina), 2000)
      : 0;
  const [config, accounts, access] = await Promise.all([
    loadLoyaltyConfig(org),
    loadLoyaltyAccounts(org, search, page),
    getOrganizationAccess(org),
  ]);
  const enabled = access.modules.includes("loyalty");
  const base = `/panel/${org}/fidelizacion`;
  const unit = config.program?.mode === "points" ? "puntos" : "visitas";
  return (
    <OrganizationScreen organizationId={org}>
      <h1 className="text-3xl font-semibold">Fidelización</h1>
      <p className="text-muted-foreground mt-3 text-sm leading-6">
        Vos definís los servicios participantes, la forma de acumular y el
        beneficio. Los puntos y visitas no representan dinero.
      </p>
      {!enabled && (
        <p className="my-5 rounded-xl border bg-white p-5 text-sm">
          Tu acceso actual no habilita operaciones de Fidelización. El historial
          se conserva. Revisá{" "}
          <Link
            className="text-primary underline"
            href={`/panel/${org}/suscripcion`}
          >
            Suscripción
          </Link>{" "}
          o pedí una habilitación del complemento a la administración.
        </p>
      )}
      <section className="my-6 space-y-4 rounded-2xl border bg-white p-6">
        {config.program && config.rule ? (
          <>
            <h2 className="text-xl font-semibold break-words">
              {config.program.name}
            </h2>
            <p className="text-sm">
              {config.program.mode === "visits"
                ? "Tarjeta de visitas"
                : "Puntos por servicio"}{" "}
              · {config.program.is_active ? "Activado" : "Pausado"} · Reglas
              versión {config.program.version}
            </p>
            <p className="text-sm">
              Vigencia:{" "}
              {periodText(
                config.rule.starts_at,
                config.rule.ends_at,
                config.context.organization.timezone,
              )}
              .
            </p>
            <p className="text-sm whitespace-pre-wrap">
              {config.rule.conditions}
            </p>
            <p className="text-muted-foreground text-sm">
              Cada acreditación conserva su regla y vencimiento. La vigencia del
              plan también debe estar activa para acreditar o canjear.
            </p>
            <div className="flex flex-wrap items-center gap-5">
              {enabled && (
                <Link
                  className="text-primary min-h-11 py-3 text-sm underline"
                  href={`${base}/configurar`}
                >
                  Editar reglas
                </Link>
              )}
              <ActionForm
                requiresModule={config.program.is_active ? false : "loyalty"}
                action={setLoyaltyActiveAction.bind(
                  null,
                  org,
                  config.program.version,
                  !config.program.is_active,
                )}
                fields={[]}
                submitLabel={
                  config.program.is_active
                    ? "Pausar programa"
                    : "Activar programa"
                }
              />
            </div>
          </>
        ) : (
          <>
            <h2 className="text-xl font-semibold">Creá tu programa</h2>
            <p className="text-muted-foreground text-sm">
              El asistente explica visitas y puntos, vigencia, canjes y
              condiciones. Al guardar las reglas podrás crear la primera
              recompensa.
            </p>
            {enabled && (
              <Link
                className="text-primary inline-flex min-h-11 items-center underline"
                href={`${base}/configurar`}
              >
                Configurar programa
              </Link>
            )}
          </>
        )}
      </section>
      <section className="mb-6 rounded-2xl border bg-white p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Recompensas</h2>
          {enabled && config.program && (
            <Link
              className="text-primary min-h-11 py-3 text-sm underline"
              href={`${base}/recompensas/nueva`}
            >
              Crear recompensa
            </Link>
          )}
        </div>
        <ul className="grid gap-4 md:grid-cols-2">
          {config.rewards.map((r) => (
            <li className="space-y-2 rounded-xl border p-4" key={r.id}>
              <h3 className="font-semibold break-words">{r.name}</h3>
              <p className="text-sm">
                {r.cost} {unit} · {r.is_active ? "Habilitada" : "Desactivada"}
              </p>
              <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                {r.benefit}
              </p>
              <p className="text-muted-foreground text-xs">
                {periodText(
                  r.starts_at,
                  r.ends_at,
                  config.context.organization.timezone,
                )}
              </p>
              {enabled && (
                <Link
                  className="text-primary inline-flex min-h-11 items-center text-sm underline"
                  href={`${base}/recompensas/${r.id}`}
                >
                  Editar recompensa
                </Link>
              )}
            </li>
          ))}
        </ul>
        {!config.rewards.length && (
          <p className="text-muted-foreground text-sm">
            Todavía no hay recompensas. Elegí un beneficio descriptivo y su
            costo; no se aplican descuentos ni cobros automáticamente.
          </p>
        )}
      </section>
      <section className="rounded-2xl border bg-white p-6">
        <h2 className="text-xl font-semibold">Tarjetas de clientes</h2>
        <p className="text-muted-foreground my-3 text-sm">
          Aparecen al acreditar un servicio, emitir una tarjeta o registrar un
          ajuste. También podés abrir Fidelización desde la ficha de un cliente.
        </p>
        <Link
          className="text-primary inline-flex min-h-11 items-center text-sm underline"
          href={`/panel/${org}/clientes`}
        >
          Buscar en Clientes
        </Link>
        <form className="my-4 flex flex-wrap gap-3">
          <label className="sr-only" htmlFor="loyalty-search">
            Buscar tarjeta por nombre o email
          </label>
          <input
            id="loyalty-search"
            name="q"
            defaultValue={search}
            maxLength={100}
            placeholder="Nombre o email"
            className="min-h-11 min-w-0 flex-1 rounded-lg border p-3"
          />
          <button className="min-h-11 rounded-lg border px-4">Buscar</button>
        </form>
        <ul className="space-y-3">
          {accounts.map((a) => (
            <li key={a.customer_id}>
              <Link
                href={`${base}/clientes/${a.customer_id}`}
                className="hover:bg-muted flex flex-wrap justify-between gap-3 rounded-xl border p-4 text-sm"
              >
                <span className="break-words">
                  {a.name}
                  {a.is_active ? "" : " · Inactivo"}
                </span>
                <strong>
                  {a.balance} {unit}
                </strong>
              </Link>
            </li>
          ))}
        </ul>
        {!accounts.length && (
          <p className="text-muted-foreground py-4 text-sm">
            No hay tarjetas para esta búsqueda.
          </p>
        )}
        <nav
          aria-label="Páginas de tarjetas"
          className="mt-5 flex gap-5 text-sm underline"
        >
          {page > 0 && (
            <Link
              href={`${base}?${new URLSearchParams({ q: search, pagina: String(page - 1) })}`}
            >
              Anterior
            </Link>
          )}
          {accounts.length === 50 && page < 2000 && (
            <Link
              href={`${base}?${new URLSearchParams({ q: search, pagina: String(page + 1) })}`}
            >
              Siguiente
            </Link>
          )}
        </nav>
      </section>
    </OrganizationScreen>
  );
}
