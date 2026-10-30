import type { Json } from "./json";
export type OnboardingFunctions = {
  get_business_onboarding: {
    Args: { p_organization_id: string };
    Returns: Json;
  };
};
