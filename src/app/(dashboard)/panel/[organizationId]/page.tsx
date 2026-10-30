import { redirect } from "next/navigation";
import { OrganizationScreen } from "@/components/layout/organization-screen";
import { BusinessDashboard } from "@/components/dashboard/business-dashboard";
import { requireOrganization } from "@/features/organizations/queries";
import { dashboardPeriod } from "@/features/dashboard/schema";
import { loadBusinessDashboard } from "@/features/dashboard/queries";
export const metadata = { title: "Resumen del negocio" };
export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { organizationId: org } = await params;
  const context = await requireOrganization(org);
  if (context.role !== "owner") redirect(`/panel/${org}/calendario`);
  const { period, invalid } = dashboardPeriod(
    await searchParams,
    context.organization.timezone,
  );
  const data = await loadBusinessDashboard(org, period);
  return (
    <OrganizationScreen organizationId={org}>
      <BusinessDashboard data={data} base={`/panel/${org}`} invalid={invalid} />
    </OrganizationScreen>
  );
}
