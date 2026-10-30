import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const args = process.argv.slice(2);
if (args.some((arg) => arg !== "--send"))
  throw new Error("Uso: npm run notifications:run [-- --send]");
const origin = process.env.NEXT_PUBLIC_APP_URL;
const secret = process.env.CRON_SECRET;
if (!origin || !secret)
  throw new Error(
    "Faltan APP_URL o CRON_SECRET. Ejecutá prepare:notifications y revisá .env.local.",
  );
const response = await fetch(new URL("/api/jobs/notifications", origin), {
  method: "POST",
  headers: {
    Authorization: `Bearer ${secret}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ dryRun: !args.includes("--send"), limit: 5 }),
  signal: AbortSignal.timeout(110000),
});
const result = await response.json();
console.log(JSON.stringify(result));
if (!response.ok) process.exitCode = 1;
