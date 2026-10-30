import { OrganizationScreen } from "@/components/layout/organization-screen";
import { BusinessOnboarding } from "@/components/onboarding/business-onboarding";
import { loadBusinessOnboarding } from "@/features/onboarding/queries";
export const metadata = { title: "Puesta en marcha" };
export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId: org } = await params;
  const data = await loadBusinessOnboarding(org);
  return (
    <OrganizationScreen organizationId={org}>
      <BusinessOnboarding data={data} base={`/panel/${org}`} />
    </OrganizationScreen>
  );
}
