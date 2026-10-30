import { z } from "zod";
export const onboardingSchema = z.object({
  professional_ready: z.boolean(),
  service_ready: z.boolean(),
  business_hours_ready: z.boolean(),
  matching_hours_ready: z.boolean(),
  booking_recorded: z.boolean(),
  public_enabled: z.boolean(),
});
export type BusinessOnboarding = z.infer<typeof onboardingSchema>;
