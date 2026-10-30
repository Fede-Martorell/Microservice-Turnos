import Link from "next/link";
import { loadCatalog } from "@/features/services/queries";
import { OrganizationScreen } from "@/components/layout/organization-screen";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Equipo" };
export default async function TeamPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId: org } = await params;
  const data = await loadCatalog(org);
  return (
    <OrganizationScreen organizationId={org}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {data.context.role === "owner" ? "Equipo" : "Mi perfil profesional"}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Profesionales con o sin cuenta de acceso.
          </p>
        </div>
        {data.context.role === "owner" && (
          <Button asChild className="min-h-11">
            <Link href={`/panel/${org}/equipo/nuevo`}>Crear profesional</Link>
          </Button>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {data.professionals.map((profile) => (
          <article key={profile.id} className="rounded-xl border bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="min-w-0 text-lg font-semibold break-words">
                {profile.name}
              </h2>
              <span className="bg-muted shrink-0 rounded-full px-3 py-1 text-xs">
                {profile.is_active ? "Activo" : "Inactivo"}
              </span>
            </div>
            <p className="text-muted-foreground mt-3 text-sm leading-6 break-words">
              {profile.description || "Sin descripción"}
            </p>
            <p className="mt-3 text-sm">
              {profile.user_id
                ? "Con cuenta vinculada"
                : "Recurso de reserva · sin cuenta"}
            </p>
            <p className="text-muted-foreground mt-2 text-sm">
              {
                data.assignments.filter((item) => item.staff_id === profile.id)
                  .length
              }{" "}
              servicios asignados
            </p>
            <Link
              href={`/panel/${org}/equipo/${profile.id}`}
              className="text-primary mt-4 inline-flex min-h-11 items-center text-sm underline"
            >
              {data.context.role === "owner"
                ? "Editar profesional y acceso"
                : "Ver mi perfil"}
            </Link>
          </article>
        ))}
      </div>
      {!data.professionals.length && (
        <div className="rounded-xl border bg-white p-8 text-center">
          <h2 className="font-medium">
            Todavía no hay profesionales disponibles
          </h2>
          <p className="text-muted-foreground mt-2 text-sm">
            {data.context.role === "owner"
              ? "Podés registrarte a vos o a otra persona, sin crear una cuenta adicional."
              : "Pedile al propietario que te vincule a un perfil activo."}
          </p>
        </div>
      )}
    </OrganizationScreen>
  );
}
