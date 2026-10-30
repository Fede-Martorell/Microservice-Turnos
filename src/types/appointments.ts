export type AppointmentStatus =
  "pending" | "confirmed" | "completed" | "canceled" | "no_show";
export type Appointment = {
  id: string;
  organization_id: string;
  staff_id: string;
  service_id: string;
  customer_name: string;
  customer_id: string;
  customer_email: string;
  customer_phone: string;
  service_name: string;
  staff_name: string;
  duration_minutes: number;
  preparation_minutes: number;
  price_minor: number;
  currency: string;
  timezone: string;
  starts_at: string;
  ends_at: string;
  occupied_until: string;
  status: AppointmentStatus;
  version: number;
  request_key: string;
  request_hash: string;
  created_by: string | null;
  source: "panel" | "public";
  created_at: string;
  updated_at: string;
};
export type AppointmentHistory = {
  id: string;
  organization_id: string;
  appointment_id: string;
  actor_id: string | null;
  actor_kind: "member" | "guest";
  event: "created" | "status_changed" | "rescheduled";
  from_status: AppointmentStatus | null;
  to_status: AppointmentStatus;
  old_starts_at: string | null;
  new_starts_at: string;
  created_at: string;
};
export type BookingSettings = {
  organization_id: string;
  min_advance_minutes: number;
  max_advance_days: number;
};
export type Slot = {
  starts_at: string;
  ends_at: string;
  occupied_until: string;
};
type ReadTable<Row> = {
  Row: Row;
  Insert: never;
  Update: never;
  Relationships: [];
};
type Scope = { p_organization_id: string };
export type AppointmentTables = {
  appointments: ReadTable<Appointment>;
  appointment_history: ReadTable<AppointmentHistory>;
  booking_settings: ReadTable<BookingSettings>;
};
export type AppointmentFunctions = {
  save_booking_settings: {
    Args: Scope & { p_min_advance_minutes: number; p_max_advance_days: number };
    Returns: undefined;
  };
  get_available_slots: {
    Args: Scope & {
      p_service_id: string;
      p_staff_id: string;
      p_day: string;
      p_appointment_id?: string | null;
    };
    Returns: Slot[];
  };
  create_appointment: {
    Args: Scope & {
      p_service_id: string;
      p_staff_id: string;
      p_starts_at: string;
      p_customer_name: string;
      p_customer_email: string;
      p_customer_phone: string;
      p_status: string;
      p_request_key: string;
    };
    Returns: string;
  };
  change_appointment_status: {
    Args: Scope & { p_id: string; p_version: number; p_status: string };
    Returns: undefined;
  };
  reschedule_appointment: {
    Args: Scope & { p_id: string; p_version: number; p_starts_at: string };
    Returns: undefined;
  };
  get_appointment_calendar: {
    Args: Scope & { p_day: string; p_days: number };
    Returns: Appointment[];
  };
};
