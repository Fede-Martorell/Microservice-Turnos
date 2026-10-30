import { notFound } from "next/navigation";
import { requireOrganization } from "@/features/organizations/queries";
import { OrganizationScreen } from "@/components/layout/organization-screen";
import { ActionForm } from "@/components/ui/action-form";
import { saveCustomerAction } from "@/features/customers/actions";
import { customerFields } from "@/features/customers/form-fields";
export const metadata = { title: "Agregar cliente" };
export default async function NewCustomerPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId: org } = await params;
  if ((await requireOrganization(org)).role !== "owner") notFound();
  return (
    <OrganizationScreen organizationId={org}>
      <section className="max-w-xl space-y-5 rounded-2xl border bg-white p-6">
        <h1 className="text-2xl font-semibold">Agregar cliente</h1>
        <p className="text-muted-foreground text-sm leading-6">
          El email identifica la ficha dentro de este negocio. Registrar un
          cliente no lo suscribe a marketing.
        </p>
        <ActionForm
          action={saveCustomerAction.bind(null, org, null, null)}
          fields={customerFields()}
          submitLabel="Guardar cliente"
          requiresModule="customers"
        />
      </section>
    </OrganizationScreen>
  );
}
