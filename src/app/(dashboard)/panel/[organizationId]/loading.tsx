export default function LoadingBusiness() {
  return (
    <div
      role="status"
      className="mx-auto max-w-6xl animate-pulse space-y-5 p-6"
    >
      <p className="text-sm">Cargando tu negocio…</p>
      <div className="bg-muted h-12 rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((n) => (
          <div key={n} className="bg-muted h-28 rounded-xl" />
        ))}
      </div>
      <div className="bg-muted h-64 rounded-xl" />
    </div>
  );
}
