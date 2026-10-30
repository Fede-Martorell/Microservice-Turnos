"use server";
import { z } from "zod";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  bookingInputSchema,
  receiptSchema,
  slugSchema,
  settingsSchema,
  type PublicActionState,
} from "./schema";
import { publicGateway } from "@/lib/public-booking/gateway";
import {
  managementCookie,
  managementToken,
  hashToken,
} from "@/lib/public-booking/visitor";
import { verifyBookingChallenge } from "./captcha";
import {
  managementContext,
  requestPublicResult,
  publicMessages,
} from "./queries";
import { catalogMutation, readFields } from "@/features/services/mutation";
import type { ActionState } from "@/types/actions";

const message = (code: string) =>
  publicMessages[code] ??
  "No pudimos conectar. Actualizá la página antes de volver a intentar.";
export async function bookPublicAction(
  slug: string,
  serviceId: string,
  staffId: string | null,
  serviceVersion: string,
  settingsVersion: string,
  _previous: PublicActionState,
  form: FormData,
): Promise<PublicActionState> {
  const context = z
    .object({
      slug: slugSchema,
      serviceId: z.uuid(),
      staffId: z.uuid().nullable(),
      serviceVersion: z.iso.datetime({ offset: true }),
      settingsVersion: z.iso.datetime({ offset: true }),
    })
    .safeParse({ slug, serviceId, staffId, serviceVersion, settingsVersion });
  if (!context.success) return { message: message("invalid") };
  const input = bookingInputSchema.safeParse({
    ...readFields(form, [
      "request_key",
      "starts_at",
      "customer_name",
      "customer_email",
      "customer_phone",
      "website",
    ]),
    accept_policy: ["on", "true"].includes(String(form.get("accept_policy"))),
  });
  if (!input.success)
    return {
      message: "Revisá los campos indicados",
      errors: input.error.flatten().fieldErrors,
    };
  const gateway = await publicGateway();
  if (!gateway || !gateway.config.canCreate)
    return {
      message:
        "Las reservas online no están disponibles en este momento. Comunicate con el negocio.",
    };
  if (!(await verifyBookingChallenge(form.get("challenge"), gateway.visitor)))
    return {
      message: "No pudimos completar la verificación. Volvé a intentarlo.",
    };
  const token = managementToken(
    slug,
    input.data.request_key,
    gateway.visitor,
    gateway.config.secret,
  );
  const result = await requestPublicResult(
    () =>
      gateway.client.rpc("create_public_booking", {
        p_slug: slug,
        p_service_id: serviceId,
        p_staff_id: staffId,
        p_starts_at: input.data.starts_at,
        p_customer_name: input.data.customer_name,
        p_customer_email: input.data.customer_email,
        p_customer_phone: input.data.customer_phone,
        p_request_key: input.data.request_key,
        p_token_hash: hashToken(token),
        p_visitor: gateway.visitor,
        p_service_version: serviceVersion,
        p_settings_version: settingsVersion,
      }),
    receiptSchema,
    "receipt",
  );
  if (!result.value) return { message: message(result.code) };
  (await cookies()).set(managementCookie, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: gateway.config.secure,
    path: "/reserva",
    expires: new Date(result.value.expires_at),
  });
  revalidatePath("/panel", "layout");
  return {
    receipt: result.value,
    link: `${gateway.config.origin}/reserva#token=${token}`,
  };
}
export async function managePublicAction(
  action: "cancel" | "reschedule",
  version: number,
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  if (
    action === "cancel" &&
    !["on", "true"].includes(String(form.get("confirm_cancel")))
  )
    return { message: "Confirmá que querés cancelar esta reserva." };
  if (!z.number().int().positive().safeParse(version).success)
    return { message: message("invalid") };
  const starts =
    action === "reschedule"
      ? z.iso.datetime({ offset: true }).safeParse(form.get("starts_at"))
      : null;
  if (starts && !starts.success) return { message: "Elegí un horario válido" };
  const context = await managementContext();
  if (!context) return { message: message("not_found") };
  const result = await requestPublicResult(
    () =>
      context.client.rpc("manage_public_booking", {
        p_token: context.token,
        p_visitor: context.visitor,
        p_version: version,
        p_action: action,
        p_starts_at: starts?.success ? starts.data : null,
      }),
    receiptSchema,
    "receipt",
  );
  if (!result.value) return { message: message(result.code) };
  (await cookies()).set(managementCookie, context.token, {
    httpOnly: true,
    sameSite: "strict",
    secure: context.config.secure,
    path: "/reserva",
    expires: new Date(result.value.expires_at),
  });
  revalidatePath("/reserva");
  revalidatePath("/panel", "layout");
  return {
    success: true,
    message: action === "cancel" ? "Reserva cancelada" : "Reserva reprogramada",
  };
}
export async function closePublicBooking() {
  (await cookies()).delete({ name: managementCookie, path: "/reserva" });
  redirect("/reserva");
}
export async function savePublicSettingsAction(
  org: string,
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const boolean = (key: string) =>
    ["on", "true"].includes(String(form.get(key))) ? "true" : "false";
  return catalogMutation(
    org,
    "public_booking.settings_failed",
    settingsSchema,
    {
      ...readFields(form, [
        "contact_email",
        "contact_phone",
        "address",
        "cancellation_policy",
        "cancellation_notice_minutes",
        "logo_url",
        "cover_url",
        "primary_color",
        "secondary_color",
      ]),
      enabled: boolean("enabled"),
      auto_confirm: boolean("auto_confirm"),
    },
    (client, input) =>
      client.rpc("save_public_booking_settings", {
        p_organization_id: org,
        p_data: input,
      }),
  );
}
export async function revokePublicLinkAction(
  org: string,
  id: string,
  _previous: ActionState,
  _form: FormData,
): Promise<ActionState> {
  void _form;
  return catalogMutation(
    org,
    "public_booking.revoke_failed",
    z.uuid(),
    id,
    (client, target) =>
      client.rpc("revoke_public_booking_link", {
        p_organization_id: org,
        p_id: target,
      }),
  );
}
