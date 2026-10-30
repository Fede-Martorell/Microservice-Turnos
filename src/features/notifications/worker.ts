import "server-only";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/types/database";
import type { Json } from "@/types/json";
import { managementToken, hashToken } from "@/lib/public-booking/visitor";
import { notificationConfig } from "./config";
import {
  buildNotificationMessage,
  notificationClaimSchema,
  messageSchema,
} from "./template";
import { sendNotification } from "./provider";
export async function runNotifications(dryRun = true, limit = 5) {
  const config = notificationConfig();
  if (!config) throw new Error("notifications_not_configured");
  if (!dryRun && !config.canSend) throw new Error("notifications_disabled");
  const client = createClient<Database>(
    config.supabase.url,
    config.supabase.key,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: { "x-notification-worker-secret": config.workerSecret },
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            cache: "no-store",
            signal: AbortSignal.timeout(8000),
          }),
      },
    },
  );
  const result = {
    dryRun,
    mode: config.mode,
    due: 0,
    processed: 0,
    sent: 0,
    retry: 0,
    failed: 0,
    skipped: 0,
  };
  const recipient = config.mode === "test" ? config.recipient : null;
  if (dryRun) {
    const { data, error } = await client.rpc("notification_queue_status", {
      p_recipient: recipient,
    });
    if (error) throw new Error("notification_queue_unavailable");
    result.due = z
      .object({ due: z.number().int().nonnegative() })
      .parse(data).due;
    return result;
  }
  for (let index = 0; index < Math.min(Math.max(limit, 1), 5); index++) {
    const { data, error } = await client.rpc("claim_notification_jobs", {
      p_limit: 1,
      p_recipient: recipient,
    });
    if (error) throw new Error("notification_claim_failed");
    const jobs = z.array(notificationClaimSchema).parse(data);
    const job = jobs[0];
    if (!job) break;
    // Nunca redirigir correos de clientes al destinatario de pruebas.
    if (config.mode === "test" && job.snapshot.customer_email !== recipient)
      throw new Error("notification_recipient_mismatch");
    let link: string | null = null;
    const publicSecret = Reflect.get(
      process.env,
      "PUBLIC_BOOKING_GATEWAY_SECRET",
    ) as string | undefined;
    if (job.access && publicSecret) {
      const token = managementToken(
        job.snapshot.slug,
        job.access.request_key,
        job.access.visitor,
        publicSecret,
      );
      if (hashToken(token) === job.access.token_hash)
        link = `${config.origin}/reserva#token=${token}`;
    }
    const message =
      job.message ?? buildNotificationMessage(job, config.from, link);
    const prepared = await client.rpc("prepare_notification_delivery", {
      p_id: job.id,
      p_claim: job.claim_token,
      p_message: message as Json,
    });
    if (prepared.error) throw new Error("notification_prepare_failed");
    if (!prepared.data) {
      result.skipped++;
      continue;
    }
    const frozen = messageSchema.parse(prepared.data);
    if (config.mode === "test" && frozen.to !== recipient)
      throw new Error("notification_recipient_mismatch");
    const delivery = await sendNotification(config.key, job.id, frozen);
    const finished = await client.rpc("finish_notification_job", {
      p_id: job.id,
      p_claim: job.claim_token,
      p_outcome: delivery.outcome,
      p_provider_id: delivery.providerId,
      p_error: delivery.error,
    });
    if (finished.error || !finished.data)
      throw new Error("notification_finish_failed");
    result.processed++;
    result[delivery.outcome]++;
  }
  return result;
}
