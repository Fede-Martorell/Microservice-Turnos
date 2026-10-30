import Link from "next/link";
import { loadAdminHome } from "@/features/subscriptions/queries";
import { subscriptionStatuses } from "@/features/subscriptions/schema";
import { formatTimestamp } from "@/features/subscriptions/presentation";
export const metadata = { title: "Negocios" };
export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = await searchParams;
  const search = typeof q.q === "string" ? q.q.slice(0, 100) : "";
  const page =
    typeof q.pagina === "string" && /^\d{1,4}$/.test(q.pagina)
      ? Math.min(Number(q.pagina), 2000)
      : 0;
  const { overview, organizations } = await loadAdminHome(search, page * 50);
  const query = new URLSearchParams({ q: search });
  return (
    <>
      <h1 className="text-3xl font-semibold">Negocios y pilotos</h1>
      <div className="my-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Negocios", overview.organizations],
          ["Accesos vigentes", overview.active_access],
          ["Pilotos vigentes", overview.pilots],
          ["Períodos vencidos", overview.expired],
        ].map(([label, value]) => (
          <div className="rounded-xl border bg-white p-4" key={label}>
            <p className="text-muted-foreground text-xs">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
      <form className="mb-6 flex flex-wrap gap-3">
        <label className="sr-only" htmlFor="search">
          Buscar negocio por nombre o dirección
        </label>
        <input
          id="search"
          name="q"
          maxLength={100}
          defaultValue={search}
          placeholder="Nombre o dirección del negocio"
          className="min-h-11 min-w-0 flex-1 rounded-lg border bg-white p-3"
        />
        <button className="min-h-11 rounded-lg border px-5">Buscar</button>
      </form>
      <ul className="space-y-3">
        {organizations.map((o) => (
          <li key={o.id}>
            <Link
              href={`/admin/negocios/${o.id}`}
              className="hover:bg-muted block rounded-xl border bg-white p-5"
            >
              <p className="font-semibold break-words">
                {o.name}{" "}
                <span className="text-muted-foreground font-normal">
                  /{o.slug}
                </span>
              </p>
              <p className="mt-2 text-sm">
                {o.plan_code} · {subscriptionStatuses[o.subscription_status]} ·
                Negocio {o.status} · {o.active_professionals} profesionales
                activos
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                Hasta {formatTimestamp(o.ends_at, "UTC")} UTC (fin exclusivo)
              </p>
            </Link>
          </li>
        ))}
      </ul>
      {!organizations.length && (
        <p className="rounded-xl border p-6">
          No hay negocios para esta búsqueda.
        </p>
      )}
      <nav
        aria-label="Páginas de negocios"
        className="mt-6 flex gap-5 text-sm underline"
      >
        {page > 0 && (
          <Link href={`/admin?${query}&pagina=${page - 1}`}>Anterior</Link>
        )}
        {organizations.length === 50 && page < 2000 && (
          <Link href={`/admin?${query}&pagina=${page + 1}`}>Siguiente</Link>
        )}
      </nav>
    </>
  );
}
