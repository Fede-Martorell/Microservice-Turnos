import type { Json } from "./json";

export type Service = {
  id: string;
  organization_id: string;
  name: string;
  description: string;
  category: string;
  duration_minutes: number;
  preparation_minutes: number;
  price_minor: number;
  currency: string;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
export type Professional = {
  id: string;
  organization_id: string;
  user_id: string | null;
  name: string;
  description: string;
  photo_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
export type StaffService = {
  organization_id: string;
  staff_id: string;
  service_id: string;
};
export type AvailabilityRule = {
  id: string;
  organization_id: string;
  staff_id: string | null;
  weekday: number;
  kind: "working" | "break";
  start_minute: number;
  end_minute: number;
  created_at: string;
};
export type AvailabilityException = {
  id: string;
  organization_id: string;
  staff_id: string | null;
  starts_on: string;
  ends_on: string;
  start_minute: number | null;
  end_minute: number | null;
  kind: "blocked" | "vacation" | "holiday";
  reason: string;
  created_at: string;
};
export type StaffInvitation = {
  id: string;
  organization_id: string;
  staff_id: string;
  email: string;
  token_hash: string;
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
};
type ReadTable<Row> = {
  Row: Row;
  Insert: never;
  Update: never;
  Relationships: [];
};
export type CatalogTables = {
  services: ReadTable<Service>;
  staff_profiles: ReadTable<Professional>;
  staff_services: ReadTable<StaffService>;
  availability_rules: ReadTable<AvailabilityRule>;
  availability_exceptions: ReadTable<AvailabilityException>;
  organization_invites: ReadTable<StaffInvitation>;
};
type Scope = { p_organization_id: string };
export type CatalogFunctions = {
  save_service: {
    Args: Scope & { p_id: string | null; p_data: Json; p_staff_ids: string[] };
    Returns: string;
  };
  save_professional: {
    Args: Scope & {
      p_id: string | null;
      p_data: Json;
      p_service_ids: string[];
    };
    Returns: string;
  };
  save_availability_rule: {
    Args: Scope & {
      p_id: string | null;
      p_staff_id: string | null;
      p_weekday: number;
      p_kind: string;
      p_start_minute: number;
      p_end_minute: number;
    };
    Returns: string;
  };
  save_availability_exception: {
    Args: Scope & {
      p_id: string | null;
      p_staff_id: string | null;
      p_starts_on: string;
      p_ends_on: string;
      p_start_minute: number | null;
      p_end_minute: number | null;
      p_kind: string;
      p_reason: string;
    };
    Returns: string;
  };
  remove_availability_entry: {
    Args: Scope & { p_id: string; p_kind: string };
    Returns: undefined;
  };
  create_staff_invitation: {
    Args: Scope & { p_staff_id: string; p_email: string };
    Returns: string;
  };
  inspect_staff_invitation: { Args: { p_token: string }; Returns: Json };
  accept_staff_invitation: { Args: { p_token: string }; Returns: string };
  revoke_staff_invitation: {
    Args: Scope & { p_id: string };
    Returns: undefined;
  };
  set_staff_access: {
    Args: Scope & { p_staff_id: string; p_enabled: boolean };
    Returns: undefined;
  };
};
