import type { CatalogTables, CatalogFunctions } from "./catalog";
import type { LoyaltyFunctions } from "./loyalty";
import type { DashboardFunctions } from "./dashboard";
import type { OnboardingFunctions } from "./onboarding";
import type {
  SubscriptionTables,
  SubscriptionFunctions,
} from "./subscriptions";
import type { AppointmentTables, AppointmentFunctions } from "./appointments";
import type { CustomerTables, CustomerFunctions } from "./customers";
import type {
  NotificationTables,
  NotificationFunctions,
} from "./notifications";
import type {
  PublicBookingTables,
  PublicBookingFunctions,
} from "./public-booking";
// Contrato SQL versionado. Regenerar con Supabase CLI cuando se configure ese flujo.
export type Organization = {
  id: string;
  name: string;
  slug: string;
  description: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  timezone: string;
  currency: string;
  status: "active" | "suspended" | "archived";
  created_by: string;
  created_at: string;
  updated_at: string;
};
export type OrganizationMember = {
  organization_id: string;
  user_id: string;
  role: "owner" | "staff";
  is_active: boolean;
  created_at: string;
};
type Table<Row, Update = never> = {
  Row: Row;
  Insert: never;
  Update: Update;
  Relationships: [];
};
export type Database = {
  public: {
    Tables: SubscriptionTables &
      CustomerTables &
      NotificationTables &
      CatalogTables &
      AppointmentTables &
      PublicBookingTables & {
        organizations: Table<
          Organization,
          Pick<Organization, "name" | "description" | "timezone" | "currency">
        >;
        organization_members: Table<OrganizationMember>;
        organization_settings: Table<{
          organization_id: string;
          locale: string;
          created_at: string;
          updated_at: string;
        }>;
        audit_logs: Table<{
          id: string;
          organization_id: string;
          actor_id: string | null;
          event: string;
          created_at: string;
        }>;
      };
    Views: { [_ in never]: never };
    Functions: OnboardingFunctions &
      DashboardFunctions &
      LoyaltyFunctions &
      SubscriptionFunctions &
      CustomerFunctions &
      NotificationFunctions &
      PublicBookingFunctions &
      CatalogFunctions &
      AppointmentFunctions & {
        create_organization: {
          Args: {
            p_name: string;
            p_slug: string;
            p_description: string;
            p_timezone: string;
            p_currency: string;
          };
          Returns: string;
        };
      };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
