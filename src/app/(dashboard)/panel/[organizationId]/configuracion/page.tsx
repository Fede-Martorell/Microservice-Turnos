import { requireOrganization } from "@/features/organizations/queries";
import { updateOrganizationAction } from "@/features/organizations/actions";
import { hasOrganizationPermission } from "@/lib/permissions/organizations";
import { OrganizationScreen } from "@/components/layout/organization-screen";
import { OrganizationForm } from "@/components/organizations/organization-form";

export const metadata = { title: "Mi organización" };
export default async function OrganizationPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const { organization, role } = await requireOrganization(organizationId);
  const canEdit = hasOrganizationPermission(role, "organization:update");
  return (
    <OrganizationScreen organizationId={organizationId}>
      <section className="max-w-2xl rounded-2xl border bg-white p-6 md:p-8">
        <span className="bg-accent text-primary rounded-full px-3 py-1 text-xs">
          {role === "owner" ? "Propietario" : "Personal"}
        </span>
        <h1 className="mt-4 text-2xl font-semibold break-words">
          {organization.name}
        </h1>
        <p className="text-muted-foreground mt-3 text-sm leading-6">
          {canEdit
            ? "Administrá la información básica de tu negocio."
            : "Tenés acceso de personal. La configuración está reservada al propietario."}
        </p>
        {canEdit ? (
          <OrganizationForm
            action={updateOrganizationAction.bind(null, organization.id)}
            initial={{
              name: organization.name,
              slug: organization.slug,
              description: organization.description,
              timezone: organization.timezone,
              currency: organization.currency,
            }}
          />
        ) : (
          <dl className="mt-6 space-y-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Descripción</dt>
              <dd className="mt-1 break-words whitespace-pre-wrap">
                {organization.description || "Sin descripción"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Zona horaria</dt>
              <dd className="mt-1">{organization.timezone}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Moneda</dt>
              <dd className="mt-1">{organization.currency}</dd>
            </div>
          </dl>
        )}
      </section>
      <p className="text-muted-foreground mt-5 max-w-2xl text-sm leading-6">
        Configurá servicios, profesionales y disponibilidad desde el menú del
        negocio. Los profesionales pueden existir sin cuenta de acceso.
      </p>
    </OrganizationScreen>
  );
}
