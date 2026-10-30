export function validatePilotEnvironment(
  env: Record<string, string | undefined>,
  options?: { local?: boolean },
): { ok: boolean; checks: { id: string; ok: boolean }[] };
