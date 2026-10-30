import { validatePilotEnvironment } from "../src/lib/deployment/pilot-environment.mjs";
const result = validatePilotEnvironment(process.env);
if (!result.ok) {
  console.error(
    JSON.stringify({
      event: "pilot.configuration_invalid",
      checks: result.checks
        .filter((check) => !check.ok)
        .map((check) => check.id),
    }),
  );
  process.exit(1);
}
process.env.PILOT_DEPLOYMENT = "1";
process.env.HOSTNAME = "0.0.0.0";
await import("../.next/standalone/server.js");
