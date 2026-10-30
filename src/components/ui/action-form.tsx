"use client";

import { startTransition, useActionState, useEffect, useId } from "react";
import { useForm } from "react-hook-form";
import type { FormAction } from "@/types/actions";
import { Input } from "./input";
import { Button } from "./button";
import { useModuleAccess } from "@/components/subscriptions/license-context";

export type FormField = {
  name: string;
  label: string;
  type?:
    | "text"
    | "hidden"
    | "number"
    | "date"
    | "email"
    | "url"
    | "textarea"
    | "select"
    | "checklist"
    | "checkbox";
  value?: string | string[] | boolean;
  required?: boolean;
  min?: number;
  max?: number;
  maxLength?: number;
  pattern?: string;
  hint?: string;
  options?: { value: string; label: string }[];
};

export function ActionForm({
  action,
  fields,
  submitLabel,
  resetOnSuccess = false,
  requiresModule = "bookings",
  linkHint = "Copiá y compartí este enlace con la persona invitada. Vence en 48 horas; se muestra solo en esta respuesta.",
  linkLabel = "Enlace de invitación",
}: {
  action: FormAction;
  fields: FormField[];
  submitLabel: string;
  resetOnSuccess?: boolean;
  requiresModule?: string | false;
  linkHint?: string;
  linkLabel?: string;
}) {
  const allowed = useModuleAccess(requiresModule);
  const [state, formAction, pending] = useActionState(action, {});
  const prefix = useId();
  const { register, handleSubmit, reset } = useForm<
    Record<string, string | string[] | boolean>
  >({
    defaultValues: Object.fromEntries(
      fields.map((field) => [
        field.name,
        field.value ??
          (field.type === "checklist"
            ? []
            : field.type === "checkbox"
              ? false
              : ""),
      ]),
    ),
  });
  useEffect(() => {
    if (resetOnSuccess && state.success) reset();
  }, [state, reset, resetOnSuccess]);
  return (
    <form
      action={formAction}
      onSubmit={handleSubmit((values) => {
        const data = new FormData();
        Object.entries(values).forEach(([name, value]) => {
          if (Array.isArray(value))
            value.forEach((item) => data.append(name, item));
          else data.set(name, String(value));
        });
        startTransition(() => formAction(data));
      })}
      className="space-y-5"
      aria-busy={pending}
    >
      {!allowed && (
        <p role="status" className="rounded-lg border p-3 text-sm">
          Tu acceso actual permite consultar estos datos. Para guardar cambios,
          revisá Suscripción con el propietario.
        </p>
      )}
      <fieldset
        disabled={!allowed || pending}
        className="space-y-5 disabled:opacity-60"
      >
        {fields.map((field) => {
          if (field.type === "hidden")
            return (
              <input key={field.name} type="hidden" {...register(field.name)} />
            );
          const id = `${prefix}-${field.name}`;
          const error = state.errors?.[field.name]?.[0];
          const common = {
            id,
            required: field.required,
            "aria-invalid": Boolean(error),
            "aria-describedby": `${id}-help ${id}-error`,
            ...register(field.name),
          };
          return (
            <div key={field.name}>
              {field.type === "checkbox" ? (
                <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
                  <input
                    type="checkbox"
                    className="accent-primary size-4"
                    {...common}
                  />
                  {field.label}
                </label>
              ) : (
                <>
                  {field.type === "checklist" ? (
                    <fieldset className="rounded-lg border p-4">
                      <legend className="px-1 text-sm font-medium">
                        {field.label}
                      </legend>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {field.options?.map((option) => (
                          <label
                            key={option.value}
                            className="flex min-h-11 items-center gap-3 text-sm"
                          >
                            <input
                              type="checkbox"
                              value={option.value}
                              className="accent-primary size-4"
                              {...register(field.name)}
                            />
                            <span className="break-words">{option.label}</span>
                          </label>
                        ))}
                      </div>
                      {!field.options?.length && (
                        <p className="text-muted-foreground text-sm">
                          Todavía no hay opciones disponibles.
                        </p>
                      )}
                    </fieldset>
                  ) : (
                    <>
                      <label
                        htmlFor={id}
                        className="mb-2 block text-sm font-medium"
                      >
                        {field.label}
                      </label>
                      {field.type === "textarea" ? (
                        <textarea
                          rows={3}
                          maxLength={field.maxLength}
                          className="border-input w-full rounded-lg border bg-white px-3.5 py-3 text-base md:text-sm"
                          {...common}
                        />
                      ) : field.type === "select" ? (
                        <select
                          className="border-input min-h-12 w-full rounded-lg border bg-white px-3.5 py-2.5 text-base md:text-sm"
                          {...common}
                        >
                          {field.options?.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Input
                          type={field.type ?? "text"}
                          min={field.min}
                          max={field.max}
                          maxLength={field.maxLength}
                          step={field.type === "number" ? 1 : undefined}
                          pattern={field.pattern}
                          {...common}
                        />
                      )}
                    </>
                  )}
                </>
              )}
              <p
                id={`${id}-help`}
                className="text-muted-foreground mt-1 text-xs leading-5"
              >
                {field.hint}
              </p>
              <p id={`${id}-error`} className="text-destructive mt-1 text-sm">
                {error}
              </p>
            </div>
          );
        })}
        {state.message && (
          <p
            role="status"
            className="bg-muted rounded-lg border p-3 text-sm leading-6"
          >
            {state.message}
          </p>
        )}
        {state.link && (
          <div className="space-y-2">
            <p className="text-sm">{linkHint}</p>
            <Input
              value={state.link}
              readOnly
              aria-label={linkLabel}
              onFocus={(event) => event.target.select()}
            />
          </div>
        )}
        <Button
          type="submit"
          disabled={pending || !allowed}
          className="min-h-11"
        >
          {pending ? "Guardando…" : submitLabel}
        </Button>
      </fieldset>
    </form>
  );
}
