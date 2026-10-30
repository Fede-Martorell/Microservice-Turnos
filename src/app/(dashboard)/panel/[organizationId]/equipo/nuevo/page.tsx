import { notFound } from "next/navigation";
import { loadCatalog } from "@/features/services/queries";
import { OrganizationScreen } from "@/components/layout/organization-screen";
import { ActionForm } from "@/components/ui/action-form";
import { professionalFields } from "@/features/staff/form-fields";
import { saveProfessionalAction } from "@/features/staff/actions";

export const metadata = { title: "Crear profesional" };
export default async function NewProfessionalPage({
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
        <h1 className="mb-6 text-2xl font-semibold">Crear profesional</h1>
        <ActionForm
          action={saveProfessionalAction.bind(null, org, null)}
          fields={professionalFields(
            data.services,
            [],
            data.members,
            data.context.user.id,
          )}
          submitLabel="Crear profesional"
        />
      </section>
    </OrganizationScreen>
  );
}
