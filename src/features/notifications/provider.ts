import "server-only";
import { Resend } from "resend";
import type { EmailMessage } from "./template";
export type DeliveryResult = {
  outcome: "sent" | "retry" | "failed";
  providerId: string | null;
  error: string | null;
};
export async function sendNotification(
  key: string,
  id: string,
  message: EmailMessage,
): Promise<DeliveryResult> {
  try {
    const result = await new Resend(key).emails.send(message, {
      idempotencyKey: `booking-notification/${id}`,
      signal: AbortSignal.timeout(8000),
    });
    if (result.data?.id)
      return { outcome: "sent", providerId: result.data.id, error: null };
    const status = result.error?.statusCode;
    const name = result.error?.name;
    const retry =
      !status ||
      status === 429 ||
      status >= 500 ||
      name === "concurrent_idempotent_requests";
    return {
      outcome: retry ? "retry" : "failed",
      providerId: null,
      error: status ? `provider_${status}` : "provider_error",
    };
  } catch {
    return { outcome: "retry", providerId: null, error: "network_error" };
  }
}
