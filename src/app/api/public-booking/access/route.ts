import { NextResponse, type NextRequest } from "next/server";
import { publicGateway } from "@/lib/public-booking/gateway";
import { managementCookie } from "@/lib/public-booking/visitor";
import { tokenSchema, receiptSchema } from "@/features/public-booking/schema";
import { requestPublicResult } from "@/features/public-booking/queries";
export async function POST(request: NextRequest) {
  const reply = (status: number) =>
    NextResponse.json(
      { ok: false },
      { status, headers: { "Cache-Control": "private, no-store" } },
    );
  const gateway = await publicGateway();
  if (!gateway) return reply(503);
  if (request.headers.get("origin") !== gateway.config.origin)
    return reply(403);
  const length = Number(request.headers.get("content-length"));
  if (length > 1024) return reply(413);
  let token: unknown;
  try {
    const reader = request.body?.getReader();
    if (!reader) return reply(400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > 1024) {
        await reader.cancel();
        return reply(413);
      }
      chunks.push(chunk.value);
    }
    const combined = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    const body = new TextDecoder().decode(combined);
    token = (JSON.parse(body) as { token?: unknown }).token;
  } catch {
    return reply(400);
  }
  const input = tokenSchema.safeParse(token);
  if (!input.success) return reply(400);
  const result = await requestPublicResult(
    () =>
      gateway.client.rpc("inspect_public_booking", {
        p_token: input.data,
        p_visitor: gateway.visitor,
      }),
    receiptSchema,
    "receipt",
  );
  if (!result.value)
    return reply(
      result.code === "rate_limited"
        ? 429
        : result.code === "offline"
          ? 503
          : 404,
    );
  const response = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "private, no-store" } },
  );
  response.cookies.set(managementCookie, input.data, {
    httpOnly: true,
    sameSite: "strict",
    secure: gateway.config.secure,
    path: "/reserva",
    expires: new Date(result.value.expires_at),
  });
  return response;
}
