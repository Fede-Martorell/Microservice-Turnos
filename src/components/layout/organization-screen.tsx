import Link from "next/link";
import { WorkspaceShell } from "./workspace-shell";
import { Building2, ChevronDown, ShieldCheck } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { requireOrganization } from "@/features/organizations/queries";
import { getOrganizationAccess } from "@/features/subscriptions/queries";
import { LicenseProvider } from "@/components/subscriptions/license-context";
import { subscriptionStatuses } from "@/features/subscriptions/schema";

export async function OrganizationScreen({
  organizationId,
  children,
}: {
  organizationId: string;
  children: React.ReactNode;
}) {
  const { organization, role } = await requireOrganization(organizationId);
  const access = await getOrganizationAccess(organizationId);
  return (
    <LicenseProvider modules={access.modules}>
      <WorkspaceShell role={role} modules={access.modules}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b pb-5">
          <Link
            href="/panel"
            aria-label={`Cambiar organización: ${organization.name}`}
            className="group flex min-w-0 items-center gap-3 rounded-lg"
          >
            <span className="text-primary flex size-11 shrink-0 items-center justify-center rounded-xl border bg-white">
              <Building2 className="size-5" strokeWidth={1.6} />
            </span>
            <span className="min-w-0">
              <span className="text-muted-foreground block text-[10px] font-medium tracking-wider uppercase">
                Tu negocio
              </span>
              <span className="block text-sm font-semibold break-words">
                {organization.name}
              </span>
            </span>
            <ChevronDown className="text-muted-foreground size-4 shrink-0" />
          </Link>
          <LogoutButton />
        </div>
        <div className="text-muted-foreground mb-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
          <p className="flex items-center gap-2">
            <ShieldCheck className="text-primary size-3.5 shrink-0" />
            {access.plan.name} ·{" "}
            {subscriptionStatuses[access.subscription.status]}
          </p>
          <p>
            {access.active_professionals} de {access.plan.max_professionals}{" "}
            profesionales activos
          </p>
          {!access.can_write && (
            <p className="text-foreground w-full rounded-lg border border-amber-200 bg-amber-50 p-3">
              El período de acceso terminó o está pausado. Conservás la consulta
              del historial y la cancelación de reservas existentes.
            </p>
          )}
          {role === "owner" && (
            <Link
              className="text-primary underline underline-offset-4"
              href={`/panel/${organizationId}/suscripcion`}
            >
              Ver suscripción y módulos
            </Link>
          )}
        </div>
        {children}
      </WorkspaceShell>
    </LicenseProvider>
  );
}
