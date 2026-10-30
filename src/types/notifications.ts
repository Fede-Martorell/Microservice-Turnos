import type { Json } from "./json";
export type NotificationSettings = {
  organization_id: string;
  enabled: boolean;
  reminders_enabled: boolean;
  reminder_minutes: number;
  updated_at: string;
};
export type NotificationJob = {
  id: string;
  organization_id: string;
  appointment_id: string;
  appointment_version: number;
  kind: "created" | "confirmed" | "canceled" | "rescheduled" | "reminder";
  status: "queued" | "processing" | "retry" | "sent" | "failed" | "skipped";
  scheduled_at: string;
  expires_at: string;
  attempts: number;
  first_attempt_at: string | null;
  lease_until: string | null;
  claim_token: string | null;
  provider_id: string | null;
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
};
type ReadTable<Row> = {
  Row: Row;
  Insert: never;
  Update: never;
  Relationships: [];
};
export type NotificationTables = {
  notification_settings: ReadTable<NotificationSettings>;
  notification_jobs: ReadTable<NotificationJob>;
};
export type NotificationFunctions = {
  save_notification_settings: {
    Args: {
      p_organization_id: string;
      p_enabled: boolean;
      p_reminders: boolean;
      p_minutes: number;
    };
    Returns: undefined;
  };
  notification_queue_status: {
    Args: { p_recipient?: string | null };
    Returns: Json;
  };
  claim_notification_jobs: {
    Args: { p_limit?: number; p_recipient?: string | null };
    Returns: Json;
  };
  prepare_notification_delivery: {
    Args: { p_id: string; p_claim: string; p_message: Json };
    Returns: Json;
  };
  finish_notification_job: {
    Args: {
      p_id: string;
      p_claim: string;
      p_outcome: string;
      p_provider_id?: string | null;
      p_error?: string | null;
    };
    Returns: boolean;
  };
};
