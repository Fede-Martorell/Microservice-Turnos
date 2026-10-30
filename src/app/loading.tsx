import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main
      id="contenido"
      aria-busy="true"
      aria-label="Cargando"
      className="mx-auto max-w-6xl space-y-6 p-8"
    >
      <span className="sr-only" role="status">
        Cargando contenido…
      </span>
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-72 w-full rounded-2xl" />
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((key) => (
          <Skeleton key={key} className="h-40" />
        ))}
      </div>
    </main>
  );
}
