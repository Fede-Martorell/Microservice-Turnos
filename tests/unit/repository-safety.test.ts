import { expect, it } from "vitest";
import {
  repositoryContentProblems,
  repositoryPathProblem,
} from "@/lib/deployment/repository-safety.mjs";
it("rechaza configuración privada, backups y archivos generados incluso si se agregan a Git", () => {
  for (const path of [
    ".env.local",
    ".env.production",
    "supabase/.local/enable_admin.sql",
    ".next/server.js",
    "backups/base.sql",
    "supabase-contra.txt",
    "test-results/private.png",
    "cert.pem",
    "database.dump",
    "supabase\\.local\\worker.sql",
  ])
    expect(repositoryPathProblem(path)).not.toBeNull();
  for (const path of [
    ".env.example",
    "supabase/migrations/20261030001200_pilot_onboarding.sql",
    "docs/showcase/onboarding.png",
    "package-lock.json",
  ])
    expect(repositoryPathProblem(path)).toBeNull();
});
it("informa el nombre del secreto sin reproducir su valor", () => {
  const secret = ["private", "fixture", "value"].join("-");
  const problems = repositoryContentProblems(`config=${secret}`, [
    { name: "SECRET_NAME", value: secret },
  ]);
  expect(problems).toEqual(["valor de SECRET_NAME"]);
  expect(JSON.stringify(problems)).not.toContain(secret);
});
it("detecta credenciales de proveedor y claves privadas sin rechazar referencias de código", () => {
  const key = ["sb_", "secret_", "x".repeat(24)].join("");
  expect(repositoryContentProblems(key)).toContain(
    "posible credencial de proveedor",
  );
  expect(
    repositoryContentProblems(["-----BEGIN ", "PRIVATE KEY-----"].join("")),
  ).toContain("clave privada");
  expect(
    repositoryContentProblems(
      "process.env.RESEND_API_KEY; sb_publishable_fixture",
    ),
  ).toEqual([]);
});
