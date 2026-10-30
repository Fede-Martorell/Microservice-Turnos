import "server-only";

export function reportServerError(event: string, error: unknown) {
  const reference = crypto.randomUUID();
  const code =
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string" &&
    /^[a-zA-Z0-9_]{1,60}$/.test(error.code)
      ? error.code
      : "unknown";
  // No incluir mensajes del proveedor, credenciales ni datos del formulario.
  console.error(JSON.stringify({ event, reference, code }));
  return reference;
}
