import { NextResponse, type NextRequest } from "next/server";
import { publicGateway } from "@/lib/public-booking/gateway";
import { requestPublicResult } from "@/features/public-booking/queries";
import { cardSchema, cardCookie } from "@/features/loyalty/schema";
import { tokenSchema } from "@/features/public-booking/schema";
export async function POST(request: NextRequest) {
  const reply = (status: number) =>
    NextResponse.json(
      { ok: false },
      { status, headers: { "Cache-Control": "private, no-store" } },
    );
  const gateway = await publicGateway();
  if (!gateway || (!gateway.config.local && !gateway.config.secure))
    return reply(503);
  if (request.headers.get("origin") !== gateway.config.origin)
    return reply(403);
  if (Number(request.headers.get("content-length")) > 1024) return reply(413);
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
    const body = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.length;
    }
    token = (JSON.parse(new TextDecoder().decode(body)) as { token?: unknown })
      .token;
  } catch {
    return reply(400);
  }
  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) return reply(400);
  const result = await requestPublicResult(
    () =>
      gateway.client.rpc("get_loyalty_card", {
        p_token: parsed.data,
        p_visitor: gateway.visitor,
      }),
    cardSchema,
    "card",
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
  response.cookies.set(cardCookie, parsed.data, {
    httpOnly: true,
    sameSite: "strict",
    secure: gateway.config.secure,
    path: "/tarjeta",
    expires: new Date(result.value.expires_at),
  });
  return response;
}
