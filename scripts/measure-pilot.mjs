// Laboratorio local con SQL e identidad sintéticos. Nunca apunta a Supabase real.
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
const label = process.argv[2] ?? "latest";
if (!["before", "after", "latest"].includes(label) || process.argv.length > 3)
  throw new Error("Uso: node scripts/measure-pilot.mjs [before|after|latest]");
const children = [];
let browser;
async function ready(url) {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(
    "No inició el servidor local de medición; comprobar puertos 3150 y 54324",
  );
}
try {
  // Evita confundir un servidor ya existente con el entorno descartable de la medición.
  for (const url of [
    "http://127.0.0.1:3150",
    "http://127.0.0.1:54324/health",
  ]) {
    let occupied = false;
    try {
      await fetch(url, { signal: AbortSignal.timeout(500) });
      occupied = true;
    } catch {}
    if (occupied) throw new Error("Los puertos de medición deben estar libres");
  }
  children.push(
    spawn(process.execPath, ["tests/fixtures/public-api.mjs"], {
      windowsHide: true,
      stdio: "ignore",
    }),
  );
  await ready("http://127.0.0.1:54324/health");
  children.push(
    spawn(process.execPath, [".next/standalone/server.js"], {
      windowsHide: true,
      stdio: "ignore",
      env: {
        ...process.env,
        PORT: "3150",
        HOSTNAME: "127.0.0.1",
        NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3150",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54324",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-fixture-key",
        PUBLIC_BOOKING_GATEWAY_SECRET: "a".repeat(64),
        NOTIFICATION_MODE: "disabled",
        RESEND_API_KEY: "",
        PILOT_DEPLOYMENT: "0",
      },
    }),
  );
  await ready("http://127.0.0.1:3150");
  const { org, token, user } = await (
    await fetch("http://127.0.0.1:54324/test-context")
  ).json();
  browser = await chromium.launch();
  const records = [];
  for (const kind of ["home", "dashboard"]) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    if (kind === "dashboard")
      await context.addCookies([
        {
          name: "sb-127-auth-token",
          value: `base64-${Buffer.from(JSON.stringify({ access_token: token, refresh_token: "fixture", expires_at: Math.floor(Date.now() / 1000) + 3600, user })).toString("base64url")}`,
          domain: "127.0.0.1",
          path: "/",
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
    const page = await context.newPage();
    await page.goto(
      `http://127.0.0.1:3150${kind === "home" ? "/" : `/panel/${org}`}`,
    );
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => document.fonts.ready);
    const measure = async () =>
      page.evaluate(() => {
        const resources = performance
          .getEntriesByType("resource")
          .filter((e) => new URL(e.name).pathname.endsWith(".js"));
        const nav = performance.getEntriesByType("navigation")[0];
        return {
          scripts: resources.length,
          jsDecodedBytes: resources.reduce((n, e) => n + e.decodedBodySize, 0),
          jsTransferredBytes: resources.reduce((n, e) => n + e.transferSize, 0),
          ttfbMs: Math.round(nav.responseStart - nav.requestStart),
          fcpMs: Math.round(
            performance.getEntriesByName("first-contentful-paint")[0]
              ?.startTime ?? 0,
          ),
        };
      });
    const initial = await measure();
    if (kind === "dashboard") {
      await page
        .getByRole("heading", { name: "Reservas por día", exact: true })
        .scrollIntoViewIfNeeded();
      await page.getByRole("application").waitFor();
      await page.waitForLoadState("networkidle");
    }
    records.push({ page: kind, initial, afterChart: await measure() });
    await context.close();
  }
  await mkdir("test-results/performance", { recursive: true });
  const result = {
    environment: "local-standalone-synthetic",
    samples: 1,
    records,
  };
  await writeFile(
    `test-results/performance/${label}.json`,
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  await browser?.close();
  for (const child of children) child.kill();
}
