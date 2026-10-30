"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main
      id="contenido"
      className="mx-auto flex min-h-screen max-w-md flex-col items-start justify-center gap-4 px-6"
    >
      <h1 className="text-2xl font-semibold">No pudimos cargar esta página</h1>
      <p className="text-muted-foreground text-sm leading-6">
        Intentá nuevamente. Si el problema continúa, volvé más tarde.
      </p>
      <Button onClick={reset}>Reintentar</Button>
      <Link
        href="/panel"
        className="text-primary inline-flex min-h-11 items-center text-sm underline"
      >
        Volver a mis organizaciones
      </Link>
      {error.digest && /^[a-zA-Z0-9_-]{1,80}$/.test(error.digest) && (
        <p className="text-muted-foreground text-xs">
          Referencia para soporte: {error.digest}
        </p>
      )}
    </main>
  );
}
