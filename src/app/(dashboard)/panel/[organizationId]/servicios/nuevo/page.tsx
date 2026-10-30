import { notFound } from "next/navigation";
import { loadCatalog } from "@/features/services/queries";
import { OrganizationScreen } from "@/components/layout/organization-screen";
import { ActionForm } from "@/components/ui/action-form";
import { serviceFields } from "@/features/services/form-fields";
import { saveServiceAction } from "@/features/services/actions";

export const metadata = { title: "Crear servicio" };
export default async function NewServicePage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId: org } = await params;
  const data = await loadCatalog(org);
  if (data.context.role !== "owner") notFound();
  return (
    <OrganizationScreen organizationId={org}>
      <section className="max-w-2xl rounded-2xl border bg-white p-6 md:p-8">
        <h1 className="mb-6 text-2xl font-semibold">Crear servicio</h1>
        <ActionForm
          action={saveServiceAction.bind(null, org, null)}
          fields={serviceFields(
            data.context.organization.currency,
            data.professionals,
            [],
          )}
          submitLabel="Crear servicio"
        />
      </section>
    </OrganizationScreen>
  );
}
