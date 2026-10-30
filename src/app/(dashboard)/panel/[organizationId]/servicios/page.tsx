import Link from "next/link";
import { loadCatalog } from "@/features/services/queries";
import { OrganizationScreen } from "@/components/layout/organization-screen";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/utils/money";

export const metadata = { title: "Servicios" };
export default async function ServicesPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { organizationId: org } = await params;
  const data = await loadCatalog(org);
  const search = await searchParams;
  const query =
    typeof search.q === "string" ? search.q.trim().slice(0, 100) : "";
  const services = data.services.filter((service) =>
    `${service.name} ${service.category}`
      .toLocaleLowerCase("es")
      .includes(query.toLocaleLowerCase("es")),
  );
  return (
    <OrganizationScreen organizationId={org}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Servicios</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Catálogo, precios y profesionales habilitados.
          </p>
        </div>
        {data.context.role === "owner" && (
          <Button asChild className="min-h-11">
            <Link href={`/panel/${org}/servicios/nuevo`}>Crear servicio</Link>
          </Button>
        )}
      </div>
      <form className="mb-6 flex gap-2" role="search">
        <label htmlFor="service-search" className="sr-only">
          Buscar servicios
        </label>
        <input
          id="service-search"
          name="q"
          defaultValue={query}
          maxLength={100}
          className="min-h-11 min-w-0 flex-1 rounded-lg border bg-white px-3 text-sm"
          placeholder="Buscar por nombre o categoría"
        />
        <Button variant="outline" className="min-h-11">
          Buscar
        </Button>
      </form>
      <div className="grid gap-4 md:grid-cols-2">
        {services.map((service) => (
          <article key={service.id} className="rounded-xl border bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="min-w-0 text-lg font-semibold break-words">
                {service.name}
              </h2>
              <span className="bg-muted shrink-0 rounded-full px-3 py-1 text-xs">
                {service.is_active ? "Activo" : "Inactivo"}
              </span>
            </div>
            <p className="text-muted-foreground mt-2 text-sm break-words">
              {service.category || "Sin categoría"}
            </p>
            <p className="mt-4 font-medium">
              {formatMoney(service.price_minor, service.currency)} ·{" "}
              {service.duration_minutes} min
            </p>
            <p className="text-muted-foreground mt-2 text-sm">
              Preparación: {service.preparation_minutes} min
            </p>
            <p className="mt-3 text-sm">
              {data.context.role === "owner" ? (
                <>
                  {
                    data.assignments.filter(
                      (assignment) => assignment.service_id === service.id,
                    ).length
                  }{" "}
                  profesionales habilitados
                </>
              ) : data.assignments.some(
                  (assignment) => assignment.service_id === service.id,
                ) ? (
                "Asignado a tu perfil"
              ) : (
                "Sin asignación a tu perfil"
              )}
            </p>
            {data.context.role === "owner" && (
              <Link
                href={`/panel/${org}/servicios/${service.id}`}
                className="text-primary mt-4 inline-flex min-h-11 items-center text-sm underline"
              >
                Editar servicio
              </Link>
            )}
          </article>
        ))}
      </div>
      {services.length === 0 && (
        <div className="rounded-xl border bg-white p-8 text-center">
          <h2 className="font-medium">
            {query ? "No hay coincidencias" : "Todavía no hay servicios"}
          </h2>
          <p className="text-muted-foreground mt-2 text-sm">
            {query
              ? "Probá otra búsqueda."
              : data.context.role === "owner"
                ? "Creá un servicio para definir su duración, precio y profesionales."
                : "El propietario puede configurar el catálogo de servicios."}
          </p>
        </div>
      )}
    </OrganizationScreen>
  );
}
