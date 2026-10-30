"use client";

import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { OrganizationInput } from "@/features/organizations/schema";
import type { FormAction } from "@/types/actions";

export function OrganizationForm({
  action,
  initial,
}: {
  action: FormAction;
  initial?: OrganizationInput;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OrganizationInput>({
    defaultValues: initial ?? {
      name: "",
      slug: "",
      description: "",
      timezone: "America/Argentina/Buenos_Aires",
      currency: "ARS",
    },
  });
  function fieldError(field: keyof OrganizationInput) {
    return (
      <p id={`${field}-error`} className="text-destructive text-sm">
        {errors[field]?.message ?? state.errors?.[field]?.[0]}
      </p>
    );
  }
  const inputClass = "mt-2";
  return (
    <form
      action={formAction}
      onSubmit={handleSubmit((values) => {
        const data = new FormData();
        Object.entries(values).forEach(([key, value]) => data.set(key, value));
        startTransition(() => formAction(data));
      })}
      className="mt-6 space-y-5"
      aria-busy={pending}
    >
      <div>
        <label htmlFor="name" className="text-sm font-medium">
          Nombre del negocio
        </label>
        <Input
          id="name"
          autoComplete="organization"
          className={inputClass}
          required
          minLength={2}
          maxLength={100}
          aria-describedby="name-error"
          aria-invalid={Boolean(errors.name || state.errors?.name)}
          {...register("name", {
            required: "Ingresá el nombre",
            minLength: { value: 2, message: "Usá al menos 2 caracteres" },
            maxLength: 100,
          })}
        />
        {fieldError("name")}
      </div>
      <div>
        <label htmlFor="slug" className="text-sm font-medium">
          Identificador único
        </label>
        <Input
          id="slug"
          className={inputClass}
          autoCapitalize="none"
          spellCheck={false}
          required
          minLength={3}
          maxLength={63}
          readOnly={Boolean(initial)}
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          aria-describedby="slug-help slug-error"
          aria-invalid={Boolean(errors.slug || state.errors?.slug)}
          {...register("slug", {
            required: "Elegí un identificador",
            minLength: { value: 3, message: "Usá al menos 3 caracteres" },
            maxLength: 63,
          })}
        />
        <p
          id="slug-help"
          className="text-muted-foreground mt-2 text-xs leading-5"
        >
          Por ejemplo, estudio-centro. Se reserva para tu negocio y se mantiene
          al editarlo. La página pública llegará en la Fase 4.
        </p>
        {fieldError("slug")}
      </div>
      <div>
        <label htmlFor="description" className="text-sm font-medium">
          Descripción{" "}
          <span className="text-muted-foreground font-normal">(opcional)</span>
        </label>
        <textarea
          id="description"
          rows={3}
          maxLength={2000}
          className="mt-2 w-full rounded-md border bg-white px-3 py-2 text-base md:text-sm"
          aria-describedby="description-error"
          aria-invalid={Boolean(
            errors.description || state.errors?.description,
          )}
          {...register("description", { maxLength: 2000 })}
        />
        {fieldError("description")}
      </div>
      <div>
        <label htmlFor="timezone" className="text-sm font-medium">
          Zona horaria
        </label>
        <Input
          id="timezone"
          list="timezones"
          required
          maxLength={100}
          className={inputClass}
          aria-describedby="timezone-help timezone-error"
          aria-invalid={Boolean(errors.timezone || state.errors?.timezone)}
          {...register("timezone", { required: "Elegí una zona horaria" })}
        />
        <datalist id="timezones">
          {[
            "America/Argentina/Buenos_Aires",
            "America/Montevideo",
            "America/Santiago",
            "America/Sao_Paulo",
            "America/Mexico_City",
            "Europe/Madrid",
            "UTC",
          ].map((zone) => (
            <option key={zone} value={zone} />
          ))}
        </datalist>
        <p
          id="timezone-help"
          className="text-muted-foreground mt-2 text-xs leading-5"
        >
          Zona IANA utilizada para mostrar los horarios de tu negocio.
        </p>
        {fieldError("timezone")}
      </div>
      <div>
        <label htmlFor="currency" className="text-sm font-medium">
          Moneda
        </label>
        <Input
          id="currency"
          list="currencies"
          required
          minLength={3}
          maxLength={3}
          pattern="[A-Z]{3}"
          autoCapitalize="characters"
          className={inputClass}
          aria-describedby="currency-help currency-error"
          aria-invalid={Boolean(errors.currency || state.errors?.currency)}
          {...register("currency", { required: "Elegí una moneda" })}
        />
        <datalist id="currencies">
          {["ARS", "USD", "EUR", "UYU", "CLP", "BRL", "MXN"].map((currency) => (
            <option key={currency} value={currency} />
          ))}
        </datalist>
        <p
          id="currency-help"
          className="text-muted-foreground mt-2 text-xs leading-5"
        >
          Código de 3 letras, por ejemplo ARS o USD. No se realizan cobros en
          esta etapa.
        </p>
        {fieldError("currency")}
      </div>
      {state.message && (
        <p
          role="status"
          className="bg-muted rounded-lg border p-3 text-sm leading-6"
        >
          {state.message}
        </p>
      )}
      <Button
        type="submit"
        className="min-h-11 w-full sm:w-auto"
        disabled={pending}
      >
        {pending
          ? "Guardando…"
          : initial
            ? "Guardar cambios"
            : "Crear organización"}
      </Button>
    </form>
  );
}
