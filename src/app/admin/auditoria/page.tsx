import { loadPlatformAudit } from "@/features/subscriptions/queries";
import { AuditList } from "@/components/subscriptions/audit-list";
export const metadata = { title: "Auditoría" };
export default async function AuditPage() {
  const entries = await loadPlatformAudit();
  return (
    <>
      <h1 className="mb-3 text-3xl font-semibold">
        Auditoría de administración
      </h1>
      <p className="text-muted-foreground mb-6 text-sm">
        Últimos 50 cambios. Estos registros no se pueden editar desde la
        aplicación.
      </p>
      <AuditList entries={entries} />
    </>
  );
}
