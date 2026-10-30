"use server";

import { z } from "zod";
import {
  professionalSchema,
  invitationSchema,
  invitationTokenSchema,
} from "./schema";
import {
  catalogMutation,
  readFields,
  readActive,
} from "@/features/services/mutation";
import { getEnvironment } from "@/lib/config/environment.server";
import type { ActionState } from "@/types/actions";

export async function saveProfessionalAction(
  org: string,
  id: string | null,
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  return catalogMutation(
    org,
    "professional.save_failed",
    professionalSchema.extend({ id: z.uuid().nullable() }),
    {
      ...readFields(form, ["name", "description", "photo_url", "user_id"]),
      id,
      is_active: readActive(form),
      service_ids: form.getAll("service_ids"),
    },
    (client, input) => {
      const { service_ids, id: target, ...data } = input;
      return client.rpc("save_professional", {
        p_organization_id: org,
        p_id: target,
        p_data: data,
        p_service_ids: service_ids,
      });
    },
    { destination: (staffId) => `/panel/${org}/equipo/${staffId}` },
  );
}
export async function createInvitationAction(
  org: string,
  staffId: string,
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  return catalogMutation(
    org,
    "invitation.create_failed",
    invitationSchema.extend({ staff_id: z.uuid() }),
    { email: form.get("email"), staff_id: staffId },
    (client, input) =>
      client.rpc("create_staff_invitation", {
        p_organization_id: org,
        p_staff_id: input.staff_id,
        p_email: input.email,
      }),
    {
      success: (data) => {
        const token = invitationTokenSchema.safeParse(data);
        if (!token.success)
          return {
            message:
              "No pudimos verificar el enlace. Revisá el listado antes de reintentar.",
          };
        return {
          success: true,
          message: "Invitación creada. No se envió ningún email.",
          link: new URL(
            `/invitacion?token=${token.data}`,
            getEnvironment()?.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
          ).toString(),
        };
      },
    },
  );
}
export async function revokeInvitationAction(
  org: string,
  id: string,
  _previous: ActionState,
  _form: FormData,
): Promise<ActionState> {
  void _form;
  return catalogMutation(
    org,
    "invitation.revoke_failed",
    z.uuid(),
    id,
    (client, target) =>
      client.rpc("revoke_staff_invitation", {
        p_organization_id: org,
        p_id: target,
      }),
  );
}
export async function setStaffAccessAction(
  org: string,
  staffId: string,
  enabled: boolean,
  _previous: ActionState,
  _form: FormData,
): Promise<ActionState> {
  void _form;
  return catalogMutation(
    org,
    "staff.access_failed",
    z.object({ id: z.uuid(), enabled: z.boolean() }),
    { id: staffId, enabled },
    (client, input) =>
      client.rpc("set_staff_access", {
        p_organization_id: org,
        p_staff_id: input.id,
        p_enabled: input.enabled,
      }),
  );
}
