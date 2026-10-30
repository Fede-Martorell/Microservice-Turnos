import Link from "next/link";
import { OrganizationScreen } from "@/components/layout/organization-screen";
import { Button } from "@/components/ui/button";
import { loadCustomers } from "@/features/customers/queries";
import { localDay } from "@/features/appointments/presentation";
export const metadata = { title: "Clientes" };
export default async function CustomersPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { organizationId: org } = await params;
  const { context, filters, items } = await loadCustomers(
    org,
    await searchParams,
  );
  const pageLink = (page: number) =>
    `/panel/${org}/clientes?${new URLSearchParams({ q: filters.q, activity: filters.activity, recurrence: filters.recurrence, page: String(page) })}`;
  return (
    <OrganizationScreen organizationId={org}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Clientes</h1>
          <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-6">
            Cada negocio conserva su propia base. Las reservas vinculan clientes
            por email; las visitas cuentan solo servicios completados.
            {context.role === "staff"
              ? " Ves únicamente clientes y reservas de tu agenda."
              : ""}
          </p>
        </div>
        {context.role === "owner" && (
          <Button asChild>
            <Link href={`/panel/${org}/clientes/nuevo`}>Agregar cliente</Link>
          </Button>
        )}
      </div>
      <form className="mb-6 grid items-end gap-4 rounded-xl border bg-white p-5 sm:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-2 text-sm">
          <span>Buscar por nombre, email o teléfono</span>
          <input
            name="q"
            defaultValue={filters.q}
            maxLength={100}
            className="min-h-11 w-full rounded-lg border px-3"
          />
        </label>
        <label className="space-y-2 text-sm">
          <span>Estado de ficha</span>
          <select
            name="activity"
            defaultValue={filters.activity}
            className="min-h-11 w-full rounded-lg border px-3"
          >
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
            <option value="all">Todos</option>
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <span>Visitas completadas</span>
          <select
            name="recurrence"
            defaultValue={filters.recurrence}
            className="min-h-11 w-full rounded-lg border px-3"
          >
            <option value="all">Todos</option>
            <option value="new">Sin visitas completadas</option>
            <option value="visited">Al menos una visita</option>
            <option value="recurrent">Recurrentes · dos o más</option>
          </select>
        </label>
        <Button type="submit" variant="outline" className="min-h-11">
          Buscar clientes
        </Button>
      </form>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <article
            key={item.id}
            className="space-y-3 rounded-xl border bg-white p-5"
          >
            <h2 className="font-semibold break-words">
              <Link
                className="text-primary inline-flex min-h-11 items-center underline"
                href={`/panel/${org}/clientes/${item.id}`}
              >
                {item.name}
              </Link>
            </h2>
            <p className="text-muted-foreground text-sm break-all">
              {item.email}
            </p>
            {item.phone && <p className="text-sm break-words">{item.phone}</p>}
            <p className="text-sm">
              {item.completed_visits} visitas completadas ·{" "}
              {item.total_reservations} reservas
            </p>
            <p className="text-muted-foreground text-xs">
              Última visita:{" "}
              {item.last_visit
                ? localDay(
                    context.organization.timezone,
                    new Date(item.last_visit),
                  )
                : "Sin visitas completadas"}
              {!item.is_active ? " · Ficha inactiva" : ""}
            </p>
          </article>
        ))}
      </div>
      {!items.length && (
        <p role="status" className="rounded-xl border bg-white p-6 text-sm">
          No hay clientes para estos filtros. Las reservas nuevas crean o
          vinculan una ficha automáticamente.
        </p>
      )}
      <nav aria-label="Páginas de clientes" className="mt-6 flex gap-4 text-sm">
        {filters.page > 0 && (
          <Link
            className="text-primary min-h-11 underline"
            href={pageLink(filters.page - 1)}
          >
            Anterior
          </Link>
        )}
        {items.length === 50 && filters.page < 2000 && (
          <Link
            className="text-primary min-h-11 underline"
            href={pageLink(filters.page + 1)}
          >
            Siguiente
          </Link>
        )}
      </nav>
    </OrganizationScreen>
  );
}
