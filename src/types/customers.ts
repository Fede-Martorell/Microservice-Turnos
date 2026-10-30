export type Customer = {
  id: string;
  organization_id: string;
  name: string;
  email: string;
  phone: string;
  is_active: boolean;
  transactional_email: boolean;
  marketing_consent: boolean;
  consent_evidence: string;
  consent_updated_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};
export type CustomerSummary = Pick<
  Customer,
  "id" | "name" | "email" | "phone" | "is_active" | "created_at"
> & {
  completed_visits: number;
  last_visit: string | null;
  total_reservations: number;
};
type ReadTable<Row> = {
  Row: Row;
  Insert: never;
  Update: never;
  Relationships: [];
};
export type CustomerTables = { customers: ReadTable<Customer> };
export type CustomerFunctions = {
  get_customer_preferences: {
    Args: { p_organization_id: string; p_id: string };
    Returns: import("./json").Json;
  };
  save_customer: {
    Args: {
      p_organization_id: string;
      p_id: string | null;
      p_version: number | null;
      p_data: import("./json").Json;
    };
    Returns: string;
  };
  save_customer_preferences: {
    Args: {
      p_organization_id: string;
      p_id: string;
      p_version: number;
      p_transactional: boolean;
      p_marketing: boolean;
      p_evidence: string;
    };
    Returns: undefined;
  };
  get_customer_directory: {
    Args: {
      p_organization_id: string;
      p_search?: string;
      p_activity?: string;
      p_recurrence?: string;
      p_offset?: number;
    };
    Returns: CustomerSummary[];
  };
};
