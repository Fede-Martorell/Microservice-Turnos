import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard, AuthSetupNotice } from "@/components/auth/auth-card";
import { AuthForm } from "@/components/auth/auth-form";
import { loginAction } from "@/lib/auth/actions";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { getSupabaseConfiguration } from "@/lib/config/environment.server";

export const metadata = { title: "Iniciar sesión" };
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sesion?: string }>;
}) {
  if (await getAuthenticatedUser()) redirect("/panel");
  const params = await searchParams;
  return (
    <AuthCard
      title="Bienvenido a tu espacio"
      description="Ingresá para gestionar tus organizaciones."
    >
      {params.error === "confirmacion" && (
        <p role="alert" className="text-destructive mt-5 text-sm">
          El enlace no es válido o venció. Intentá ingresar con tu cuenta
          confirmada.
        </p>
      )}
      {params.sesion === "cerrada" && (
        <p role="status" className="text-primary mt-5 text-sm">
          Cerraste la sesión en este dispositivo.
        </p>
      )}
      {getSupabaseConfiguration() ? (
        <AuthForm mode="login" action={loginAction} />
      ) : (
        <AuthSetupNotice />
      )}
      <p className="text-muted-foreground mt-6 text-center text-sm">
        ¿Todavía no tenés cuenta?{" "}
        <Link className="text-primary font-medium underline" href="/registro">
          Crear cuenta
        </Link>
      </p>
    </AuthCard>
  );
}
