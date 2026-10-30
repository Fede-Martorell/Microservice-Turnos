"use server";

import { z } from "zod";
import {
  availabilityRuleSchema,
  availabilityExceptionSchema,
  parseClock,
} from "./availability-schema";
import { catalogMutation, readFields } from "@/features/services/mutation";
import type { ActionState } from "@/types/actions";

export async function saveRuleAction(
  org: string,
  staffId: string | null,
  id: string | null,
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  return catalogMutation(
    org,
    "availability.save_failed",
    availabilityRuleSchema.safeExtend({
      id: z.uuid().nullable(),
      staff_id: z.uuid().nullable(),
    }),
    {
      ...readFields(form, ["weekday", "kind", "start", "end"]),
      id,
      staff_id: staffId,
    },
    (client, input) =>
      client.rpc("save_availability_rule", {
        p_organization_id: org,
        p_id: input.id,
        p_staff_id: input.staff_id,
        p_weekday: input.weekday,
        p_kind: input.kind,
        p_start_minute: parseClock(input.start)!,
        p_end_minute: parseClock(input.end)!,
      }),
  );
}
export async function saveExceptionAction(
  org: string,
  staffId: string | null,
  id: string | null,
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  return catalogMutation(
    org,
    "exception.save_failed",
    availabilityExceptionSchema.safeExtend({
      id: z.uuid().nullable(),
      staff_id: z.uuid().nullable(),
    }),
    {
      ...readFields(form, [
        "starts_on",
        "ends_on",
        "start",
        "end",
        "kind",
        "reason",
      ]),
      id,
      staff_id: staffId,
    },
    (client, input) =>
      client.rpc("save_availability_exception", {
        p_organization_id: org,
        p_id: input.id,
        p_staff_id: input.staff_id,
        p_starts_on: input.starts_on,
        p_ends_on: input.ends_on,
        p_start_minute: input.start ? parseClock(input.start) : null,
        p_end_minute: input.end ? parseClock(input.end) : null,
        p_kind: input.kind,
        p_reason: input.reason,
      }),
  );
}
export async function removeAvailabilityAction(
  org: string,
  id: string,
  kind: "rule" | "exception",
  _previous: ActionState,
  _form: FormData,
): Promise<ActionState> {
  void _form;
  return catalogMutation(
    org,
    "availability.remove_failed",
    z.object({ id: z.uuid(), kind: z.enum(["rule", "exception"]) }),
    { id, kind },
    (client, input) =>
      client.rpc("remove_availability_entry", {
        p_organization_id: org,
        p_id: input.id,
        p_kind: input.kind,
      }),
  );
}
