import Link from "next/link";
import { ArrowRight, Building2, Plus, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { listOrganizations } from "@/features/organizations/queries";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { LogoutButton } from "@/components/auth/logout-button";
import { Button } from "@/components/ui/button";
import { isPlatformAdmin } from "@/features/subscriptions/queries";

export const metadata = { title: "Mis organizaciones" };
export default async function PanelPage() {
  const user = await requireUser();
  const organizations = await listOrganizations();
  const admin = await isPlatformAdmin();
  return (
    <WorkspaceShell>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-muted-foreground mb-2 text-sm break-all">
            Sesión iniciada como {user.email}
          </p>
          <h1 className="page-title">Mis organizaciones</h1>
        </div>
        <LogoutButton />
      </div>
      {admin && (
        <Link
          href="/admin"
          className="text-primary mb-6 block text-sm underline"
        >
          Abrir administración del SaaS
        </Link>
      )}
      <section className="surface-panel p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Elegí tu espacio de trabajo</h2>
          <Button asChild className="min-h-11">
            <Link href="/panel/organizaciones/nueva">
              <Plus className="size-4" />
              Crear organización
            </Link>
          </Button>
        </div>
        {organizations.length ? (
          <ul className="mt-6 grid gap-4 md:grid-cols-2">
            {organizations.map((organization) => (
              <li key={organization.id}>
                <Link
                  href={`/panel/${organization.id}`}
                  className="surface-link flex min-h-28 items-center gap-4 rounded-xl border p-5"
                >
                  <Building2 className="text-primary size-6 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-semibold">
                      {organization.name}
                    </span>
                    <span className="text-muted-foreground mt-1 block text-sm">
                      {organization.currency} · {organization.timezone}
                    </span>
                  </span>
                  <ArrowRight className="size-4 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="py-12 text-center">
            <Building2 className="text-muted-foreground mx-auto mb-4 size-10" />
            <h3 className="text-lg font-medium">
              Tu primer negocio empieza acá
            </h3>
            <p className="text-muted-foreground mx-auto mt-3 max-w-md text-sm leading-6">
              Todavía no pertenecés a ninguna organización activa. Creá una para
              configurar su nombre, zona horaria y moneda.
            </p>
          </div>
        )}
      </section>
      <p className="text-muted-foreground mt-5 flex items-center gap-2 text-xs">
        <ShieldCheck className="size-4" />
        Solo se muestran organizaciones activas a las que tenés acceso.
      </p>
    </WorkspaceShell>
  );
}
