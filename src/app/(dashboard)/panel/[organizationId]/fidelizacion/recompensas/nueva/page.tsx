import Link from "next/link";
import { OrganizationScreen } from "@/components/layout/organization-screen";
import { RewardEditor } from "@/components/loyalty/reward-editor";
import { loadLoyaltyConfig } from "@/features/loyalty/queries";
import { localDay, lastDay } from "@/features/subscriptions/presentation";
export const metadata = { title: "Crear recompensa" };
export default async function NewRewardPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId: org } = await params;
  const config = await loadLoyaltyConfig(org);
  const zone = config.context.organization.timezone;
  return (
    <OrganizationScreen organizationId={org}>
      <Link
        className="text-primary mb-5 block text-sm underline"
        href={`/panel/${org}/fidelizacion`}
      >
        ← Fidelización
      </Link>
      <h1 className="mb-6 text-3xl font-semibold">Creá una recompensa</h1>
      <section className="max-w-2xl rounded-2xl border bg-white p-6">
        {config.program && config.rule ? (
          <RewardEditor
            org={org}
            mode={config.program.mode}
            zone={zone}
            startsOn={localDay(config.rule.starts_at, zone)}
            endsOn={lastDay(config.rule.ends_at, zone)}
          />
        ) : (
          <Link
            className="underline"
            href={`/panel/${org}/fidelizacion/configurar`}
          >
            Primero configurá el programa
          </Link>
        )}
      </section>
    </OrganizationScreen>
  );
}
