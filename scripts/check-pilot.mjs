import nextEnv from "@next/env";
import { validatePilotEnvironment } from "../src/lib/deployment/pilot-environment.mjs";
if (process.argv.slice(2).some((arg) => arg !== "--local"))
  throw new Error("Uso: npm run pilot:check [-- --local]");
nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
const result = validatePilotEnvironment(process.env, {
  local: process.argv.includes("--local"),
});
for (const check of result.checks)
  console.log(`${check.ok ? "OK" : "FALTA"} ${check.id}`);
console.log(
  "Solo verifica formato/configuración; no comprueba proveedores, permisos remotos ni entrega de emails.",
);
if (process.argv.includes("--local"))
  console.log("Modo local: este resultado no habilita una publicación.");
process.exitCode = result.ok ? 0 : 1;
