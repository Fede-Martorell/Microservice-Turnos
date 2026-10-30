import nextEnv from "@next/env";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
const privateNames = [
  "RESEND_API_KEY",
  "NOTIFICATION_WORKER_SECRET",
  "CRON_SECRET",
  "PUBLIC_BOOKING_GATEWAY_SECRET",
  "PUBLIC_BOOKING_TURNSTILE_SECRET_KEY",
  "NOTIFICATION_TEST_RECIPIENT",
  "PLATFORM_ADMIN_EMAIL",
  "SUPABASE_DB_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
];
const privateValues = privateNames
  .map((name) => ({ name, value: process.env[name] }))
  .filter(({ value }) => value && value.length >= 8);
const failures = new Set();
let scripts = 0;
async function walk(root, inspect) {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    await inspect(path, entry);
    if (entry.isDirectory()) await walk(path, inspect);
  }
}
await walk(".next/standalone", async (path, entry) => {
  const name = entry.name.toLowerCase();
  if (
    name.startsWith(".env") ||
    ["supabase-contra.txt", "backups", ".local-postgres"].includes(name) ||
    /supabase[\\/]\.local(?:[\\/]|$)/.test(path)
  )
    failures.add(
      `Archivo privado dentro de standalone: ${relative(".next/standalone", path)}`,
    );
});
for (const root of [".next/static", "public"])
  await walk(root, async (path, entry) => {
    if (!entry.isFile() || !/\.(js|json|map|html|txt)$/i.test(path)) return;
    if (path.endsWith(".js")) scripts++;
    const content = await readFile(path, "utf8");
    for (const { name, value } of privateValues)
      if (content.includes(value))
        failures.add(`Valor privado ${name} en artefacto público`);
    if (/sb_secret_[A-Za-z0-9_-]{16,}|re_[A-Za-z0-9]{24,}/.test(content))
      failures.add("Posible credencial de proveedor en artefacto público");
  });
if (failures.size) {
  for (const failure of failures) console.error(failure);
  process.exitCode = 1;
} else
  console.log(
    `Artefactos revisados: ${scripts} archivos JS; sin archivos privados en standalone ni coincidencias de secretos conocidos en recursos públicos. No sustituye una revisión de seguridad.`,
  );
