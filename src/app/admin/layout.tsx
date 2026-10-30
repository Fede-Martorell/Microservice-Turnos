import Link from "next/link";
import { requirePlatformAdmin } from "@/features/subscriptions/queries";
import { LogoutButton } from "@/components/auth/logout-button";
import { Brand } from "@/components/layout/brand";
import { ShieldCheck } from "lucide-react";
export const metadata = {
  title: {
    default: "Administración SaaS",
    template: "%s · Administración SaaS",
  },
  robots: { index: false, follow: false },
};
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePlatformAdmin();
  return (
    <div className="mx-auto min-h-dvh max-w-6xl px-5 py-7 sm:px-8">
      <header className="mb-9 flex flex-wrap items-center justify-between gap-6 rounded-2xl border bg-white p-5 sm:p-6">
        <div>
          <div className="mb-5 flex flex-wrap items-center gap-4">
            <Brand />
            <span className="status-pill bg-sage text-primary">
              <ShieldCheck className="size-3.5" />
              Administración SaaS
            </span>
          </div>
          <nav
            aria-label="Administración"
            className="text-primary flex flex-wrap gap-x-5 gap-y-3 text-xs font-medium underline underline-offset-4"
          >
            <Link href="/admin">Negocios</Link>
            <Link href="/admin/planes">Planes y pruebas</Link>
            <Link href="/admin/auditoria">Auditoría</Link>
            <Link href="/panel">Mis organizaciones</Link>
          </nav>
        </div>
        <LogoutButton />
      </header>
      <main id="contenido">{children}</main>
    </div>
  );
}
