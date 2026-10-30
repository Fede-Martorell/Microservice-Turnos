import type { Json } from "./json";
export type DashboardFunctions = {
  get_business_dashboard: {
    Args: { p_organization_id: string; p_from: string; p_to: string };
    Returns: Json;
  };
};
