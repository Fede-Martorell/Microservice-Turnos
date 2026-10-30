import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { notificationConfig } from "@/features/notifications/config";
import { runNotifications } from "@/features/notifications/worker";
import { reportServerError } from "@/lib/errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
};
export async function POST(request: Request) {
  const config = notificationConfig();
  const supplied = request.headers.get("authorization") ?? "";
  const expected = config ? `Bearer ${config.cronSecret}` : "";
  if (
    !expected ||
    Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  )
    return Response.json({ ok: false }, { status: 401, headers });
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return Response.json({ ok: false }, { status: 415, headers });
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    if (reader) {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        length += part.value.length;
        if (length > 512) {
          await reader.cancel();
          return Response.json({ ok: false }, { status: 413, headers });
        }
        chunks.push(part.value);
      }
    }
  } catch {
    return Response.json({ ok: false }, { status: 400, headers });
  }
  let input;
  try {
    input = z
      .object({
        dryRun: z.boolean().default(true),
        limit: z.number().int().min(1).max(5).default(5),
      })
      .strict()
      .safeParse(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
  } catch {
    return Response.json({ ok: false }, { status: 400, headers });
  }
  if (!input.success)
    return Response.json({ ok: false }, { status: 400, headers });
  if (!input.data.dryRun && !config?.canSend)
    return Response.json(
      { ok: false, code: "notifications_disabled" },
      { status: 503, headers },
    );
  try {
    return Response.json(
      {
        ok: true,
        ...(await runNotifications(input.data.dryRun, input.data.limit)),
      },
      { headers },
    );
  } catch (error) {
    reportServerError("notifications.run_failed", error);
    return Response.json(
      { ok: false, code: "notification_worker_unavailable" },
      { status: 503, headers },
    );
  }
}
