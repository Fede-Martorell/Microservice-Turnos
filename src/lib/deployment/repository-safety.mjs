export function repositoryPathProblem(path) {
  const name = path.replaceAll("\\", "/");
  if (name === ".env.example") return null;
  if (
    /(^|\/)\.env(?:\.|$)|(^|\/)(?:\.local-postgres|backups|\.next|node_modules|test-results|playwright-report)(?:\/|$)|(^|\/)supabase\/\.local(?:\/|$)|(^|\/)supabase-contra\.txt$|\.(?:pem|key|p12|pfx|dump|backup)$/i.test(
      name,
    )
  )
    return "archivo privado o generado";
  return null;
}
export function repositoryContentProblems(content, values = []) {
  const problems = [];
  for (const { name, value } of values)
    if (value && value.length >= 8 && content.includes(value))
      problems.push(`valor de ${name}`);
  if (/\bsb_secret_[A-Za-z0-9_-]{16,}|\bre_[A-Za-z0-9]{24,}/.test(content))
    problems.push("posible credencial de proveedor");
  if (/^-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/m.test(content))
    problems.push("clave privada");
  return problems;
}
