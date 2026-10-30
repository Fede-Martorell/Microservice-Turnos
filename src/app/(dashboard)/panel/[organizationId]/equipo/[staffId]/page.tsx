import { notFound } from "next/navigation";
import Link from "next/link";
import { loadCatalog } from "@/features/services/queries";
import { OrganizationScreen } from "@/components/layout/organization-screen";
import { ActionForm } from "@/components/ui/action-form";
import { professionalFields } from "@/features/staff/form-fields";
import {
  saveProfessionalAction,
  createInvitationAction,
  revokeInvitationAction,
  setStaffAccessAction,
} from "@/features/staff/actions";

export const metadata = { title: "Profesional" };
export default async function ProfessionalPage({
  params,
}: {
  params: Promise<{ organizationId: string; staffId: string }>;
}) {
  const { organizationId: org, staffId } = await params;
  const data = await loadCatalog(org);
  const profile = data.professionals.find((item) => item.id === staffId);
  if (!profile) notFound();
  const owner = data.context.role === "owner";
  const member = data.members.find((item) => item.user_id === profile.user_id);
  return (
    <OrganizationScreen organizationId={org}>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border bg-white p-6 md:p-8">
          <h1 className="mb-6 text-2xl font-semibold break-words">
            {owner ? "Editar profesional" : profile.name}
          </h1>
          {owner ? (
            <ActionForm
              action={saveProfessionalAction.bind(null, org, profile.id)}
              fields={professionalFields(
                data.services,
                data.assignments
                  .filter((item) => item.staff_id === profile.id)
                  .map((item) => item.service_id),
                data.members,
                data.context.user.id,
                profile,
              )}
              submitLabel="Guardar profesional"
            />
          ) : (
            <p className="text-sm leading-6 break-words">
              {profile.description || "Sin descripción"}
            </p>
          )}
        </section>
        <section className="space-y-5 rounded-2xl border bg-white p-6">
          <h2 className="text-lg font-semibold">Agenda y acceso</h2>
          <Link
            href={`/panel/${org}/disponibilidad?profesional=${profile.id}`}
            className="text-primary inline-flex min-h-11 items-center text-sm underline"
          >
            Ver disponibilidad
          </Link>
          {owner && (
            <>
              {profile.user_id ? (
                <>
                  <p className="text-sm">
                    Cuenta vinculada ·{" "}
                    {member?.is_active
                      ? "Acceso habilitado"
                      : "Acceso suspendido"}
                  </p>
                  {member?.role === "staff" && (
                    <ActionForm
                      action={setStaffAccessAction.bind(
                        null,
                        org,
                        profile.id,
                        !member.is_active,
                      )}
                      fields={[]}
                      submitLabel={
                        member.is_active
                          ? "Suspender acceso al panel"
                          : "Habilitar acceso al panel"
                      }
                    />
                  )}
                  <p className="text-muted-foreground text-xs leading-5">
                    Suspender el acceso conserva el recurso de reserva y su
                    historial. El acceso del propietario está protegido.
                  </p>
                </>
              ) : profile.is_active ? (
                <>
                  <h3 className="font-medium">Invitar a usar el panel</h3>
                  <p className="text-muted-foreground text-sm leading-6">
                    La persona debe crear y confirmar su cuenta con este correo.
                    Podrás copiar el enlace para que acepte el acceso de
                    personal.
                  </p>
                  <ActionForm
                    action={createInvitationAction.bind(null, org, profile.id)}
                    fields={[
                      {
                        name: "email",
                        label: "Email de la persona",
                        type: "email",
                        required: true,
                        maxLength: 254,
                      },
                    ]}
                    submitLabel="Generar invitación"
                    requiresModule="team_access"
                  />
                </>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Activá el profesional antes de generar una invitación.
                </p>
              )}
              {data.invitations
                .filter(
                  (item) =>
                    item.staff_id === profile.id &&
                    !item.accepted_at &&
                    !item.revoked_at,
                )
                .map((invite) => (
                  <div key={invite.id} className="space-y-3 border-t pt-4">
                    <p className="text-sm break-all">
                      Invitación para {invite.email}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Vence:{" "}
                      {new Intl.DateTimeFormat("es-AR", {
                        dateStyle: "short",
                        timeStyle: "short",
                        timeZone: data.context.organization.timezone,
                      }).format(new Date(invite.expires_at))}
                    </p>
                    <ActionForm
                      action={revokeInvitationAction.bind(null, org, invite.id)}
                      fields={[]}
                      submitLabel="Revocar invitación"
                      requiresModule={false}
                    />
                  </div>
                ))}
            </>
          )}
        </section>
      </div>
    </OrganizationScreen>
  );
}
