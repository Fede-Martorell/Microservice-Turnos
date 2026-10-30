import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { OrganizationForm } from "@/components/organizations/organization-form";
import { createOrganizationAction } from "@/features/organizations/actions";

export const metadata = { title: "Crear organización" };
export default async function NewOrganizationPage() {
  await requireUser();
  return (
    <WorkspaceShell>
      <Link href="/panel" className="text-primary text-sm underline">
        Volver a mis organizaciones
      </Link>
      <section className="mt-6 max-w-2xl rounded-2xl border bg-white p-6 md:p-8">
        <h1 className="text-2xl font-semibold">Creá tu organización</h1>
        <p className="text-muted-foreground mt-3 text-sm leading-6">
          Vas a ser su propietario. Podés crear hasta 3 organizaciones cada 24
          horas; cada una conserva sus datos y accesos por separado.
        </p>
        <OrganizationForm action={createOrganizationAction} />
      </section>
    </WorkspaceShell>
  );
}
