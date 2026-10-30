import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrganization } from "@/features/organizations/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { publicBookingConfig } from "@/lib/public-booking/config";
import { OrganizationScreen } from "@/components/layout/organization-screen";
import { ActionForm } from "@/components/ui/action-form";
import { savePublicSettingsAction } from "@/features/public-booking/actions";
import { reportServerError } from "@/lib/errors";
export const metadata = { title: "Página pública" };
export default async function PublicSettingsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId: org } = await params;
  const context = await requireOrganization(org);
  if (context.role !== "owner") notFound();
  const client = await createSupabaseServerClient();
  const { data, error } = await client
    .from("public_booking_settings")
    .select("*")
    .eq("organization_id", org)
    .maybeSingle();
  if (error) {
    reportServerError("public_settings.read_failed", error);
    throw new Error("No pudimos cargar la configuración pública");
  }
  const config = publicBookingConfig();
  return (
    <OrganizationScreen organizationId={org}>
      <section className="max-w-2xl space-y-5 rounded-2xl border bg-white p-6 md:p-8">
        <h1 className="text-2xl font-semibold">Página pública de reservas</h1>
        <p className="text-muted-foreground text-sm leading-6">
          El nombre, descripción, servicios y profesionales activos se toman de
          tu catálogo. Activá la página cuando hayas revisado precios,
          asignaciones y horarios.
        </p>
        <p className="text-muted-foreground text-sm leading-6">
          Para mostrar turnos, configurá horarios de Trabajo tanto para Negocio
          como para cada profesional: deben coincidir en el día elegido y
          alcanzar para la duración del servicio y su preparación. Revisalos en{" "}
          <Link
            href={`/panel/${org}/disponibilidad`}
            className="text-primary underline"
          >
            Disponibilidad
          </Link>
          .
        </p>
        {data?.enabled && (
          <Link
            href={`/b/${context.organization.slug}`}
            className="text-primary inline-flex min-h-11 items-center text-sm underline"
          >
            Ver página pública · /b/{context.organization.slug}
          </Link>
        )}
        {!config?.canCreate && (
          <p role="status" className="bg-muted rounded-lg border p-4 text-sm">
            Falta completar la configuración del servidor o la protección
            Turnstile antes de aceptar reservas públicas.
          </p>
        )}
        <ActionForm
          action={savePublicSettingsAction.bind(null, org)}
          submitLabel="Guardar página pública"
          requiresModule={false}
          fields={[
            {
              name: "enabled",
              label: "Habilitar página pública de reservas",
              type: "checkbox",
              value: data?.enabled ?? false,
            },
            {
              name: "auto_confirm",
              label: "Confirmar automáticamente las reservas nuevas",
              type: "checkbox",
              value: data?.auto_confirm ?? false,
              hint: "Si queda desmarcado, llegan como pendientes y tu equipo las confirma desde el calendario. Ambos estados ocupan el horario.",
            },
            {
              name: "contact_email",
              label: "Email público (opcional)",
              type: "email",
              maxLength: 254,
              value: data?.contact_email ?? "",
            },
            {
              name: "contact_phone",
              label: "Teléfono público (opcional)",
              maxLength: 40,
              value: data?.contact_phone ?? "",
            },
            {
              name: "address",
              label: "Dirección pública (opcional)",
              maxLength: 300,
              value: data?.address ?? "",
            },
            {
              name: "cancellation_policy",
              label: "Política de cancelación",
              type: "textarea",
              required: true,
              maxLength: 1500,
              value: data?.cancellation_policy ?? "",
              hint: "Explicá las condiciones que aceptará el cliente. Se guardan con cada reserva.",
            },
            {
              name: "cancellation_notice_minutes",
              label:
                "Anticipación mínima para cancelar o reprogramar (minutos)",
              type: "number",
              required: true,
              min: 0,
              max: 43200,
              value: String(data?.cancellation_notice_minutes ?? 1440),
            },
            {
              name: "logo_url",
              label: "Logo por URL HTTPS (opcional)",
              type: "url",
              maxLength: 2048,
              value: data?.logo_url ?? "",
            },
            {
              name: "cover_url",
              label: "Portada por URL HTTPS (opcional)",
              type: "url",
              maxLength: 2048,
              value: data?.cover_url ?? "",
            },
            {
              name: "primary_color",
              label: "Color principal",
              required: true,
              value: data?.primary_color ?? "#355741",
              pattern: "#[0-9a-fA-F]{6}",
              hint: "Formato #355741. El texto se ajusta automáticamente para mantener contraste.",
            },
            {
              name: "secondary_color",
              label: "Color secundario",
              required: true,
              value: data?.secondary_color ?? "#eaf0e6",
              pattern: "#[0-9a-fA-F]{6}",
            },
          ]}
        />
      </section>
    </OrganizationScreen>
  );
}
