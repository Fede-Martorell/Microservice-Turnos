import { defineConfig, devices } from "@playwright/test";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
const publicFixture = process.env.E2E_PUBLIC_FIXTURE === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: publicFixture
    ? [
        "**/public-booking.spec.ts",
        "**/loyalty-card.spec.ts",
        "**/business-dashboard.spec.ts",
      ]
    : undefined,
  testIgnore: publicFixture
    ? undefined
    : [
        "**/public-booking.spec.ts",
        "**/loyalty-card.spec.ts",
        "**/business-dashboard.spec.ts",
      ],
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
    { name: "mobile-webkit", use: { ...devices["iPhone 13"] } },
  ],
  webServer: [
    ...(publicFixture
      ? [
          {
            command: "node tests/fixtures/public-api.mjs",
            url: "http://127.0.0.1:54324/health",
            reuseExistingServer: false,
            timeout: 60000,
          },
        ]
      : []),
    {
      command: "npm run start",
      env: {
        HOSTNAME: "127.0.0.1",
        PORT: "3100",
        NOTIFICATION_MODE: "disabled",
        RESEND_API_KEY: "",
        NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3100",
        NEXT_PUBLIC_SUPABASE_URL: publicFixture
          ? "http://127.0.0.1:54324"
          : process.env.E2E_USE_CONFIGURED_SUPABASE === "1"
            ? (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
            : "",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicFixture
          ? "public-fixture-key"
          : process.env.E2E_USE_CONFIGURED_SUPABASE === "1"
            ? (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "")
            : "",
        PUBLIC_BOOKING_GATEWAY_SECRET: publicFixture
          ? "a".repeat(64)
          : process.env.E2E_USE_CONFIGURED_SUPABASE === "1"
            ? (process.env.PUBLIC_BOOKING_GATEWAY_SECRET ?? "")
            : "",
        PUBLIC_BOOKING_TURNSTILE_SITE_KEY: "",
        PUBLIC_BOOKING_TURNSTILE_SECRET_KEY: "",
      },
      url: "http://127.0.0.1:3100",
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
