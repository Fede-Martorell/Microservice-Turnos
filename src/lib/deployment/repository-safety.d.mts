export function repositoryPathProblem(path: string): string | null;
export function repositoryContentProblems(
  content: string,
  values?: { name: string; value?: string }[],
): string[];
