import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main
      id="contenido"
      className="mx-auto flex min-h-screen max-w-md flex-col items-start justify-center gap-4 px-6"
    >
      <p className="text-muted-foreground text-sm">404</p>
      <h1 className="text-2xl font-semibold">Esta página no está disponible</h1>
      <p className="text-muted-foreground text-sm">
        Revisá la dirección o regresá a tu espacio.
      </p>
      <Button asChild>
        <Link href="/">Volver al inicio</Link>
      </Button>
    </main>
  );
}
