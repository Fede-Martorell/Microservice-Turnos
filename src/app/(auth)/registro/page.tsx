import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard, AuthSetupNotice } from "@/components/auth/auth-card";
import { AuthForm } from "@/components/auth/auth-form";
import { registerAction } from "@/lib/auth/actions";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { getSupabaseConfiguration } from "@/lib/config/environment.server";

export const metadata = { title: "Crear cuenta" };
export default async function RegistrationPage() {
  if (await getAuthenticatedUser()) redirect("/panel");
  return (
    <AuthCard
      title="Creá tu cuenta"
      description="El primer paso para organizar tu negocio en un espacio propio."
    >
      {getSupabaseConfiguration() ? (
        <AuthForm mode="register" action={registerAction} />
      ) : (
        <AuthSetupNotice />
      )}
      <p className="text-muted-foreground mt-6 text-center text-sm">
        ¿Ya tenés cuenta?{" "}
        <Link className="text-primary font-medium underline" href="/ingresar">
          Iniciar sesión
        </Link>
      </p>
    </AuthCard>
  );
}
