import { readFile, writeFile, mkdir } from "node:fs/promises";
import { randomBytes, createHash } from "node:crypto";
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd(), true);
const path = new URL("../.env.local", import.meta.url);
let content = await readFile(path, "utf8").catch(() => "");
let secret = process.env.PUBLIC_BOOKING_GATEWAY_SECRET;
if (!secret) {
  secret = randomBytes(32).toString("hex");
  const line = `PUBLIC_BOOKING_GATEWAY_SECRET=${secret}`;
  content = /^PUBLIC_BOOKING_GATEWAY_SECRET=.*$/m.test(content)
    ? content.replace(/^PUBLIC_BOOKING_GATEWAY_SECRET=.*$/m, () => line)
    : `${content.trimEnd()}\n${line}\n`;
  await writeFile(path, content);
}
if (!/^[0-9a-f]{64}$/.test(secret))
  throw new Error(
    "PUBLIC_BOOKING_GATEWAY_SECRET debe contener 64 caracteres hexadecimales; no se modificó el valor existente.",
  );
const hash = createHash("sha256").update(secret).digest("hex");
const directory = new URL("../supabase/.local/", import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(
  new URL("enable_public_booking_gateway.sql", directory),
  `-- Configuración local. Ejecutar después de la migración 004. Solo contiene el hash.\nbegin;\ninsert into private.public_booking_gateway(singleton,secret_hash) values(true,'${hash}') on conflict(singleton) do update set secret_hash=excluded.secret_hash;\ncommit;\n`,
);
console.log(
  "Clave de servidor preparada en .env.local. No se muestra ni se incluye en Git.",
);
console.log(
  "SQL de configuración: supabase/.local/enable_public_booking_gateway.sql",
);
