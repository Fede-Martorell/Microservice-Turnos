import type { PlatformAudit } from "@/types/subscriptions";
import { formatTimestamp } from "@/features/subscriptions/presentation";
const labels: Record<string, string> = {
  "admin.provisioned": "Acceso administrativo otorgado",
  "plan.saved": "Plan guardado",
  "subscription.saved": "Suscripción guardada",
  "module.saved": "Configuración de módulo guardada",
  "organization.status_saved": "Estado del negocio actualizado",
  "trial_policy.saved": "Política de pruebas actualizada",
};
export function AuditList({ entries }: { entries: PlatformAudit[] }) {
  return (
    <ul className="space-y-3">
      {entries.map((a) => (
        <li key={a.id} className="rounded-xl border bg-white p-4 text-sm">
          <p className="font-medium">{labels[a.event] ?? a.event}</p>
          <p className="text-muted-foreground mt-1 text-xs break-all">
            {formatTimestamp(a.created_at, "UTC")} UTC · Cuenta{" "}
            {a.actor_id ?? "Sistema"}
          </p>
          <details className="mt-3">
            <summary className="cursor-pointer">Detalle registrado</summary>
            <pre className="bg-muted mt-2 overflow-auto rounded-lg p-3 text-xs">
              {JSON.stringify(a.detail, null, 2)}
            </pre>
          </details>
        </li>
      ))}
      {!entries.length && (
        <li className="text-muted-foreground text-sm">
          Sin cambios administrativos registrados.
        </li>
      )}
    </ul>
  );
}
