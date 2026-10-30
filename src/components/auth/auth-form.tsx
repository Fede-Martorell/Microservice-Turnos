"use client";

import { startTransition, useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FormAction } from "@/types/actions";

export function AuthForm({
  mode,
  action,
}: {
  mode: "login" | "register";
  action: FormAction;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ email: string; password: string }>();
  const signup = mode === "register";
  return (
    <form
      action={formAction}
      onSubmit={handleSubmit((values) => {
        const data = new FormData();
        Object.entries(values).forEach(([key, value]) => data.set(key, value));
        startTransition(() => formAction(data));
      })}
      className="auth-form mt-8 space-y-5"
      aria-busy={pending}
    >
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          maxLength={254}
          aria-invalid={Boolean(errors.email || state.errors?.email)}
          aria-describedby="email-error"
          {...register("email", { required: "Ingresá tu email" })}
        />
        <p id="email-error" className="text-destructive text-sm">
          {errors.email?.message ?? state.errors?.email?.[0]}
        </p>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="password" className="text-sm font-medium">
            Contraseña
          </label>
          <button
            type="button"
            className="text-muted-foreground hover:text-primary flex min-h-11 items-center gap-1.5 rounded px-2 text-xs"
            aria-controls="password"
            aria-pressed={showPassword}
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? (
              <EyeOff className="size-3.5" />
            ) : (
              <Eye className="size-3.5" />
            )}
            {showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          </button>
        </div>
        <Input
          id="password"
          type={showPassword ? "text" : "password"}
          autoComplete={signup ? "new-password" : "current-password"}
          required
          minLength={signup ? 12 : 1}
          maxLength={128}
          aria-invalid={Boolean(errors.password || state.errors?.password)}
          aria-describedby={
            signup ? "password-error password-help" : "password-error"
          }
          {...register("password", {
            required: "Ingresá tu contraseña",
            minLength: signup
              ? { value: 12, message: "Usá al menos 12 caracteres" }
              : 1,
            maxLength: 128,
          })}
        />
        {signup && (
          <p
            id="password-help"
            className="text-muted-foreground text-xs leading-5"
          >
            Usá al menos 12 caracteres. Podés usar una frase larga y fácil de
            recordar.
          </p>
        )}
        <p id="password-error" className="text-destructive text-sm">
          {errors.password?.message ?? state.errors?.password?.[0]}
        </p>
      </div>
      {state.message && (
        <p
          role="status"
          className="bg-muted rounded-lg border p-3 text-sm leading-6"
        >
          {state.message}
        </p>
      )}
      <Button type="submit" className="min-h-11 w-full" disabled={pending}>
        {pending ? "Procesando…" : signup ? "Crear cuenta" : "Iniciar sesión"}
      </Button>
      {signup && (
        <p className="text-muted-foreground text-xs leading-5">
          Creá tu cuenta para gestionar un negocio. No se solicita tarjeta ni se
          realizan cobros.
        </p>
      )}
    </form>
  );
}
