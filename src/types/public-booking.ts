import type { Json } from "./json";
export type PublicBookingSettings = {
  organization_id: string;
  enabled: boolean;
  auto_confirm: boolean;
  contact_email: string;
  contact_phone: string;
  address: string;
  cancellation_policy: string;
  cancellation_notice_minutes: number;
  logo_url: string | null;
  cover_url: string | null;
  primary_color: string;
  secondary_color: string;
  updated_at: string;
};
export type PublicBookingTables = {
  public_booking_settings: {
    Row: PublicBookingSettings;
    Insert: never;
    Update: never;
    Relationships: [];
  };
};
export type PublicBookingFunctions = {
  save_public_booking_settings: {
    Args: { p_organization_id: string; p_data: Json };
    Returns: undefined;
  };
  revoke_public_booking_link: {
    Args: { p_organization_id: string; p_id: string };
    Returns: undefined;
  };
  get_public_booking_catalog: {
    Args: { p_slug: string; p_visitor: string };
    Returns: Json;
  };
  get_public_booking_slots: {
    Args: {
      p_slug: string;
      p_service_id: string;
      p_staff_id: string | null;
      p_day: string;
      p_visitor: string;
    };
    Returns: Json;
  };
  create_public_booking: {
    Args: {
      p_slug: string;
      p_service_id: string;
      p_staff_id: string | null;
      p_starts_at: string;
      p_customer_name: string;
      p_customer_email: string;
      p_customer_phone: string;
      p_request_key: string;
      p_token_hash: string;
      p_visitor: string;
      p_service_version: string;
      p_settings_version: string;
    };
    Returns: Json;
  };
  inspect_public_booking: {
    Args: { p_token: string; p_visitor: string };
    Returns: Json;
  };
  get_public_reschedule_slots: {
    Args: { p_token: string; p_day: string; p_visitor: string };
    Returns: Json;
  };
  manage_public_booking: {
    Args: {
      p_token: string;
      p_visitor: string;
      p_version: number;
      p_action: string;
      p_starts_at?: string | null;
    };
    Returns: Json;
  };
};
