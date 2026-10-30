import Link from "next/link";
import { z } from "zod";
import { AuthCard } from "@/components/auth/auth-card";
import { InvitationAccept } from "@/components/auth/invitation-accept";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { reportServerError } from "@/lib/errors";
import { invitationTokenSchema } from "@/features/staff/schema";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Invitación al equipo",
  robots: { index: false, follow: false },
};
const previewSchema = z.object({
  organization_name: z.string(),
  staff_name: z.string(),
  expires_at: z.iso.datetime({ offset: true }),
});

export default async function InvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const token = invitationTokenSchema.safeParse((await searchParams).token);
  if (!token.success) return <Unavailable />;
  const user = await getAuthenticatedUser();
  if (!user)
    return (
      <AuthCard
        title="Invitación al equipo"
        description="Ingresá con el correo al que enviaron la invitación. Si todavía no tenés cuenta, registrate y confirmá tu email."
      >
        <p className="mt-4 text-sm leading-6">
          Después de ingresar, volvé a abrir este enlace para revisar y aceptar
          la invitación.
        </p>
        <div className="text-primary mt-5 flex flex-wrap gap-5 text-sm underline">
          <Link href="/ingresar">Ingresar</Link>
          <Link href="/registro">Crear cuenta</Link>
        </div>
      </AuthCard>
    );
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("inspect_staff_invitation", {
    p_token: token.data,
  });
  if (error) {
    reportServerError("invitation.inspect_failed", error);
    throw new Error("No pudimos verificar la invitación. Intentá nuevamente.");
  }
  const preview = previewSchema.safeParse(data);
  if (!preview.success) return <Unavailable />;
  return (
    <AuthCard
      title="Sumarte al equipo"
      description={`Te invitaron a ${preview.data.organization_name} como ${preview.data.staff_name}.`}
    >
      <p className="mt-4 text-sm leading-6">
        Al aceptar, tu cuenta tendrá acceso de personal: podrás ver el catálogo
        y tu configuración de disponibilidad. El propietario administra los
        cambios.
      </p>
      <p className="text-muted-foreground mt-3 text-xs">
        Cuenta actual: {user.email}
      </p>
      <InvitationAccept token={token.data} />
    </AuthCard>
  );
}
function Unavailable() {
  return (
    <AuthCard
      title="Invitación no disponible"
      description="El enlace no es válido, venció, fue revocado o corresponde a otro correo. Ingresá con la cuenta invitada o pedí un enlace nuevo."
    >
      <Link
        href="/panel"
        className="text-primary mt-5 inline-flex min-h-11 items-center text-sm underline"
      >
        Ir a Mis organizaciones
      </Link>
    </AuthCard>
  );
}
