import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";

// Solo arranque y health. Valores sintéticos; ninguna llamada a proveedores.
const url = "http://127.0.0.1:3151/api/health";
let occupied = false;
try {
  await fetch(url, { signal: AbortSignal.timeout(500) });
  occupied = true;
} catch {}
assert(!occupied, "El puerto 3151 debe estar libre");
const env = {
  PATH: process.env.PATH,
  SystemRoot: process.env.SystemRoot,
  TEMP: process.env.TEMP,
  NODE_ENV: "production",
  PORT: "3151",
  NEXT_TELEMETRY_DISABLED: "1",
  NEXT_PUBLIC_APP_URL: "https://pilot.example.test",
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
  PUBLIC_BOOKING_GATEWAY_SECRET: "a".repeat(64),
  PUBLIC_BOOKING_TURNSTILE_SITE_KEY: "fixture-site",
  PUBLIC_BOOKING_TURNSTILE_SECRET_KEY: "fixture-secret",
  NOTIFICATION_MODE: "disabled",
};
const invalid = spawn(process.execPath, ["scripts/start-pilot.mjs"], {
  windowsHide: true,
  stdio: "ignore",
  env: { ...env, NEXT_PUBLIC_APP_URL: "http://localhost:3151" },
});
const watchdog = setTimeout(() => invalid.kill(), 10_000);
try {
  assert.equal(
    (await once(invalid, "exit"))[0],
    1,
    "Debe rechazar localhost en hosting",
  );
} finally {
  clearTimeout(watchdog);
}
const valid = spawn(process.execPath, ["scripts/start-pilot.mjs"], {
  windowsHide: true,
  stdio: "ignore",
  env,
});
try {
  let response;
  for (let attempt = 0; attempt < 100; attempt++) {
    assert(
      valid.exitCode === null,
      "El servidor de piloto terminó antes del healthcheck",
    );
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.equal(response?.status, 200);
  assert.deepEqual(await response.json(), {
    status: "ok",
    scope: "process_and_configuration",
    dependencies: "not_checked",
  });
  assert.equal(response.headers.get("cache-control"), "no-store");
  const head = await fetch(url, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  assert.equal((await fetch(url, { method: "POST" })).status, 405);
  console.log(
    "PASS: arranque estricto rechaza configuración insegura y sirve health GET/HEAD sin consultar proveedores.",
  );
} finally {
  valid.kill();
}
