import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const result = spawnSync(
  process.execPath,
  [
    fileURLToPath(
      new URL("../node_modules/@playwright/test/cli.js", import.meta.url),
    ),
    "test",
  ],
  {
    stdio: "inherit",
    windowsHide: true,
    env: { ...process.env, E2E_PUBLIC_FIXTURE: "1" },
  },
);
process.exitCode = result.status ?? 1;
