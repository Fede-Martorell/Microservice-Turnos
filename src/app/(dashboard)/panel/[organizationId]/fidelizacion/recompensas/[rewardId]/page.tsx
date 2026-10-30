import Link from "next/link";
import { notFound } from "next/navigation";
import { OrganizationScreen } from "@/components/layout/organization-screen";
import { RewardEditor } from "@/components/loyalty/reward-editor";
import { loadLoyaltyConfig } from "@/features/loyalty/queries";
import { localDay, lastDay } from "@/features/subscriptions/presentation";
export const metadata = { title: "Editar recompensa" };
export default async function RewardPage({
  params,
}: {
  params: Promise<{ organizationId: string; rewardId: string }>;
}) {
  const { organizationId: org, rewardId } = await params;
  const config = await loadLoyaltyConfig(org);
  const reward = config.rewards.find((r) => r.id === rewardId);
  if (!reward || !config.program || !config.rule) notFound();
  const zone = config.context.organization.timezone;
  return (
    <OrganizationScreen organizationId={org}>
      <Link
        className="text-primary mb-5 block text-sm underline"
        href={`/panel/${org}/fidelizacion`}
      >
        ← Fidelización
      </Link>
      <h1 className="mb-6 text-3xl font-semibold">Editar recompensa</h1>
      <p className="text-muted-foreground mb-5 text-sm">
        Los canjes ya registrados conservan el costo, beneficio y condiciones
        que tenían al realizarse.
      </p>
      <section className="max-w-2xl rounded-2xl border bg-white p-6">
        <RewardEditor
          org={org}
          mode={config.program.mode}
          zone={zone}
          startsOn={localDay(config.rule.starts_at, zone)}
          endsOn={lastDay(config.rule.ends_at, zone)}
          reward={reward}
        />
      </section>
    </OrganizationScreen>
  );
}
