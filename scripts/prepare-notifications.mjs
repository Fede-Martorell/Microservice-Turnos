import { readFile, writeFile, mkdir } from "node:fs/promises";
import { randomBytes, createHash } from "node:crypto";
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const file = new URL("../.env.local", import.meta.url);
let content = await readFile(file, "utf8").catch(() => "");
const values = {};
for (const name of ["NOTIFICATION_WORKER_SECRET", "CRON_SECRET"]) {
  const value = process.env[name] || randomBytes(32).toString("hex");
  if (!/^[0-9a-f]{64}$/.test(value))
    throw new Error(
      `${name}: se requieren 64 caracteres hexadecimales; no se modificó.`,
    );
  values[name] = value;
}
for (const [name, value] of Object.entries(values)) {
  if (!process.env[name]) {
    const pattern = new RegExp(`^${name}=.*$`, "m");
    content = pattern.test(content)
      ? content.replace(pattern, () => `${name}=${value}`)
      : `${content.trimEnd()}\n${name}=${value}\n`;
  }
}
if (!/^NOTIFICATION_MODE=/m.test(content))
  content += `\nNOTIFICATION_MODE=disabled\n`;
await writeFile(file, content);
const dir = new URL("../supabase/.local/", import.meta.url);
await mkdir(dir, { recursive: true });
const hash = createHash("sha256")
  .update(values.NOTIFICATION_WORKER_SECRET)
  .digest("hex");
await writeFile(
  new URL("enable_notification_worker.sql", dir),
  `-- Ejecutar después de migración 006. Contiene solo un hash.\nbegin;\ninsert into private.notification_worker(singleton,secret_hash) values(true,'${hash}') on conflict(singleton) do update set secret_hash=excluded.secret_hash;\ncommit;\n`,
);
console.log(
  "Secretos de worker/cron preparados en .env.local, sin mostrarlos. Envíos desactivados.",
);
console.log("SQL: supabase/.local/enable_notification_worker.sql");
