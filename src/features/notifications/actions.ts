"use server";
import { z } from "zod";
import { catalogMutation, readFields } from "@/features/services/mutation";
import { activeSchema } from "@/features/services/schema";
import type { ActionState } from "@/types/actions";
export async function saveNotificationSettingsAction(
  org: string,
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const bool = (key: string) =>
    ["on", "true"].includes(String(form.get(key))) ? "true" : "false";
  return catalogMutation(
    org,
    "notifications.settings_failed",
    z.object({
      enabled: activeSchema,
      reminders_enabled: activeSchema,
      reminder_minutes: z.coerce.number().int().min(60).max(10080),
    }),
    {
      ...readFields(form, ["reminder_minutes"]),
      enabled: bool("enabled"),
      reminders_enabled: bool("reminders_enabled"),
    },
    (client, input) =>
      client.rpc("save_notification_settings", {
        p_organization_id: org,
        p_enabled: input.enabled,
        p_reminders: input.reminders_enabled,
        p_minutes: input.reminder_minutes,
      }),
  );
}
