import { execFileSync } from "node:child_process";
import { readFile, lstat } from "node:fs/promises";
import nextEnv from "@next/env";
import {
  repositoryPathProblem,
  repositoryContentProblems,
} from "../src/lib/deployment/repository-safety.mjs";

nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
const names = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
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
const values = names.map((name) => ({ name, value: process.env[name] }));
const files = [
  ...new Set(
    execFileSync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      { encoding: "utf8" },
    )
      .split("\0")
      .filter(Boolean),
  ),
];
const problems = [];
for (const file of files) {
  const pathProblem = repositoryPathProblem(file);
  if (pathProblem) {
    problems.push(`${file}: ${pathProblem}`);
    continue;
  }
  let info;
  try {
    info = await lstat(file);
  } catch (error) {
    if (error.code === "ENOENT") continue;
    throw error;
  }
  if (!info.isFile()) {
    problems.push(`${file}: se requiere archivo regular`);
    continue;
  }
  if (info.size > 25 * 1024 * 1024) {
    problems.push(`${file}: supera 25 MB; revisar antes de subir`);
    continue;
  }
  const content = await readFile(file, "utf8");
  for (const problem of repositoryContentProblems(content, values))
    problems.push(`${file}: ${problem}`);
}
if (problems.length) {
  problems.forEach((problem) => console.error(problem));
  process.exitCode = 1;
} else
  console.log(
    `Revisión de ${files.length} archivos candidatos: sin archivos privados/generados ni coincidencias de secretos conocidos. No sustituye revisión manual.`,
  );
