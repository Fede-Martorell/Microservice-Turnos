import { notFound } from "next/navigation";
import { loadCatalog } from "@/features/services/queries";
import { OrganizationScreen } from "@/components/layout/organization-screen";
import { ActionForm } from "@/components/ui/action-form";
import { serviceFields } from "@/features/services/form-fields";
import { saveServiceAction } from "@/features/services/actions";

export const metadata = { title: "Editar servicio" };
export default async function ServicePage({
  params,
}: {
  params: Promise<{ organizationId: string; serviceId: string }>;
}) {
  const { organizationId: org, serviceId } = await params;
  const data = await loadCatalog(org);
  const service = data.services.find((item) => item.id === serviceId);
  if (!service || data.context.role !== "owner") notFound();
  return (
    <OrganizationScreen organizationId={org}>
      <section className="max-w-2xl rounded-2xl border bg-white p-6 md:p-8">
        <h1 className="mb-6 text-2xl font-semibold">Editar servicio</h1>
        <ActionForm
          action={saveServiceAction.bind(null, org, service.id)}
          fields={serviceFields(
            data.context.organization.currency,
            data.professionals,
            data.assignments
              .filter((item) => item.service_id === service.id)
              .map((item) => item.staff_id),
            service,
          )}
          submitLabel="Guardar servicio"
        />
      </section>
    </OrganizationScreen>
  );
}
