import { validatePilotEnvironment } from "@/lib/deployment/pilot-environment.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
function health(head = false) {
  const pilot = Reflect.get(process.env, "PILOT_DEPLOYMENT") === "1";
  const ready = !pilot || validatePilotEnvironment(process.env).ok;
  return new Response(
    head
      ? null
      : JSON.stringify({
          status: ready ? "ok" : "unavailable",
          scope: pilot ? "process_and_configuration" : "process",
          dependencies: "not_checked",
        }),
    {
      status: ready ? 200 : 503,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    },
  );
}
export function GET() {
  return health();
}
export function HEAD() {
  return health(true);
}
