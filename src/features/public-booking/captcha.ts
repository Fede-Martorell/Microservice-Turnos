import "server-only";
import { z } from "zod";
import { publicBookingConfig } from "@/lib/public-booking/config";
export async function verifyBookingChallenge(token: unknown, visitor: string) {
  const config = publicBookingConfig();
  if (!config) return false;
  if (config.local && !config.captchaSecret && !config.siteKey) return true;
  if (
    !config.captchaSecret ||
    !config.siteKey ||
    typeof token !== "string" ||
    !token ||
    token.length > 2048
  )
    return false;
  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: config.captchaSecret,
          response: token,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok) return false;
    const result = z
      .object({
        success: z.boolean(),
        hostname: z.string().optional(),
        action: z.string().optional(),
        cdata: z.string().optional(),
      })
      .safeParse(await response.json());
    return (
      result.success &&
      result.data.success &&
      result.data.hostname === new URL(config.origin).hostname &&
      result.data.action === "booking" &&
      result.data.cdata === visitor
    );
  } catch {
    return false;
  }
}
