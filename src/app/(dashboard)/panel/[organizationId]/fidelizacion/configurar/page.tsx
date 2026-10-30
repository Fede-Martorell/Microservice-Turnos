import Link from "next/link";
import { OrganizationScreen } from "@/components/layout/organization-screen";
import { ProgramWizard } from "@/components/loyalty/program-wizard";
import {
  loadLoyaltyConfig,
  loadLoyaltyServices,
} from "@/features/loyalty/queries";
import { localDay, lastDay } from "@/features/subscriptions/presentation";
import { addDays } from "@/features/appointments/presentation";
export const metadata = { title: "Configurar fidelización" };
export default async function ProgramPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId: org } = await params;
  const [config, services] = await Promise.all([
    loadLoyaltyConfig(org),
    loadLoyaltyServices(org),
  ]);
  const zone = config.context.organization.timezone;
  const today = localDay(new Date().toISOString(), zone);
  return (
    <OrganizationScreen organizationId={org}>
      <Link
        className="text-primary mb-5 block text-sm underline"
        href={`/panel/${org}/fidelizacion`}
      >
        ← Fidelización
      </Link>
      <h1 className="mb-6 text-3xl font-semibold">Configurá tu programa</h1>
      <section className="rounded-2xl border bg-white p-6 sm:p-8">
        {services.filter((s) => s.is_active).length ? (
          <ProgramWizard
            org={org}
            config={{
              program: config.program,
              rule: config.rule,
              services: config.services,
              rewards: config.rewards,
              mode_locked: config.mode_locked,
            }}
            services={services}
            today={config.rule ? localDay(config.rule.starts_at, zone) : today}
            lastDay={
              config.rule
                ? lastDay(config.rule.ends_at, zone)
                : addDays(today, 365)
            }
          />
        ) : (
          <p>
            Primero creá o activá un servicio desde Servicios. El programa
            existente se puede pausar desde Fidelización.
          </p>
        )}
      </section>
    </OrganizationScreen>
  );
}
