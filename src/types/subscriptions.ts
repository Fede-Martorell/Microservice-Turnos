import type { Json } from "./json";
export type Plan = {
  code: string;
  name: string;
  description: string;
  price_minor: number;
  currency: string;
  max_professionals: number;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
};
export type Module = {
  code: string;
  name: string;
  description: string;
  is_available: boolean;
  reference_price_minor: number;
  reference_currency: string;
};
export type Subscription = {
  organization_id: string;
  plan_code: string;
  status: "pilot" | "trial" | "active" | "past_due" | "canceled" | "suspended";
  starts_at: string;
  ends_at: string;
  quoted_price_minor: number;
  quoted_currency: string;
  version: number;
  created_at: string;
  updated_at: string;
};
export type ModuleOverride = {
  organization_id: string;
  module_code: string;
  enabled: boolean;
  starts_at: string;
  ends_at: string;
  reason: string;
  version: number;
};
export type Feedback = {
  id: string;
  organization_id: string;
  created_by: string;
  problems: string;
  difficulty: number;
  requests: string;
  perceived_value: number;
  willing_to_pay: string;
  suggestions: string;
  created_at: string;
};
export type PlatformAudit = {
  id: string;
  actor_id: string | null;
  organization_id: string | null;
  event: string;
  detail: Json;
  created_at: string;
};
type Table<Row> = { Row: Row; Insert: never; Update: never; Relationships: [] };
type Rpc<Args, Returns = undefined> = { Args: Args; Returns: Returns };
type Scope = { p_organization_id: string };
export type SubscriptionTables = {
  subscription_plans: Table<Plan>;
  module_catalog: Table<Module>;
  plan_entitlements: Table<{ plan_code: string; module_code: string }>;
  organization_subscriptions: Table<Subscription>;
  organization_modules: Table<ModuleOverride>;
  pilot_feedback: Table<Feedback>;
  platform_audit_logs: Table<PlatformAudit>;
  platform_access_settings: Table<{
    singleton: boolean;
    default_plan_code: string;
    trial_days: number;
  }>;
};
export type SubscriptionFunctions = {
  get_platform_admin_context: Rpc<Record<string, never>, boolean>;
  get_organization_access: Rpc<Scope, Json>;
  admin_overview: Rpc<Record<string, never>, Json>;
  admin_list_organizations: Rpc<{ p_search?: string; p_offset?: number }, Json>;
  admin_get_organization: Rpc<Scope, Json>;
  admin_save_plan: Rpc<{
    p_code: string;
    p_version: number | null;
    p_data: Json;
    p_modules: string[];
  }>;
  admin_save_subscription: Rpc<
    Scope & {
      p_version: number;
      p_plan: string;
      p_status: string;
      p_starts_on: string;
      p_ends_on: string;
      p_reason: string;
      p_notes: string;
    }
  >;
  admin_save_module: Rpc<
    Scope & {
      p_module: string;
      p_version: number | null;
      p_enabled: boolean;
      p_starts_on: string;
      p_ends_on: string;
      p_reason: string;
    }
  >;
  admin_set_organization_status: Rpc<
    Scope & { p_status: string; p_reason: string }
  >;
  admin_save_trial_policy: Rpc<{ p_plan: string; p_days: number }>;
  save_pilot_feedback: Rpc<Scope & { p_data: Json }, string>;
};
