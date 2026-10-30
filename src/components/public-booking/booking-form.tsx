"use client";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import { useForm } from "react-hook-form";
import Script from "next/script";
import Link from "next/link";
import { bookPublicAction } from "@/features/public-booking/actions";
import type { PublicActionState } from "@/features/public-booking/schema";
import type { Slot } from "@/types/appointments";
import { localTime } from "@/features/appointments/presentation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BookingReceipt } from "./receipt";

type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}
type Values = {
  request_key: string;
  starts_at: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  accept_policy: boolean;
  website: string;
};
export function PublicBookingForm({
  slug,
  serviceId,
  staffId,
  serviceVersion,
  settingsVersion,
  slots,
  zone,
  requestKey,
  siteKey,
  visitor,
  policy,
}: {
  slug: string;
  serviceId: string;
  staffId: string | null;
  serviceVersion: string;
  settingsVersion: string;
  slots: Slot[];
  zone: string;
  requestKey: string;
  siteKey: string | null;
  visitor: string;
  policy: string;
}) {
  const action = bookPublicAction.bind(
    null,
    slug,
    serviceId,
    staffId,
    serviceVersion,
    settingsVersion,
  );
  const [state, formAction, pending] = useActionState<
    PublicActionState,
    FormData
  >(action, {});
  const { register, handleSubmit } = useForm<Values>({
    defaultValues: {
      request_key: requestKey,
      starts_at: slots[0]?.starts_at ?? "",
      customer_name: "",
      customer_email: "",
      customer_phone: "",
      accept_policy: false,
      website: "",
    },
  });
  const holder = useRef<HTMLDivElement>(null),
    widget = useRef<string | null>(null);
  const [challenge, setChallenge] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!siteKey || !ready || !holder.current || !window.turnstile) return;
    widget.current = window.turnstile.render(holder.current, {
      sitekey: siteKey,
      action: "booking",
      cData: visitor,
      callback: (token: string) => {
        setChallenge(token);
      },
      "expired-callback": () => {
        setChallenge("");
      },
    });
    return () => {
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, [siteKey, ready, visitor]);
  useEffect(() => {
    if (state.message && widget.current) {
      window.turnstile?.reset(widget.current);
    }
  }, [state]);
  if (state.receipt)
    return (
      <div className="space-y-5">
        <p
          role="status"
          className="bg-accent rounded-xl border p-4 font-medium"
        >
          {state.receipt.status === "confirmed"
            ? "Tu reserva está confirmada"
            : "Tu solicitud fue recibida"}
        </p>
        <BookingReceipt receipt={state.receipt} />
        {state.link && (
          <section className="space-y-4 rounded-2xl border bg-white p-6">
            <h2 className="font-semibold">Guardá tu enlace de gestión</h2>
            <p className="text-muted-foreground text-sm leading-6">
              Con este enlace podés consultar, cancelar o reprogramar el turno
              según la política del negocio. Quien lo tenga podrá gestionar esta
              reserva. Guardalo en un lugar privado.
            </p>
            <Input
              readOnly
              value={state.link}
              aria-label="Enlace privado de gestión"
              onFocus={(event) => event.target.select()}
            />
            <Button asChild>
              <Link href={state.link}>Ver y gestionar mi reserva</Link>
            </Button>
          </section>
        )}
      </div>
    );
  const fields = [
    {
      name: "customer_name" as const,
      label: "Tu nombre",
      type: "text",
      max: 100,
    },
    {
      name: "customer_email" as const,
      label: "Tu email",
      type: "email",
      max: 254,
    },
    {
      name: "customer_phone" as const,
      label: "Teléfono (opcional)",
      type: "tel",
      max: 30,
    },
  ];
  return (
    <form
      action={formAction}
      onSubmit={handleSubmit((values) => {
        const form = new FormData();
        Object.entries(values).forEach(([key, value]) =>
          form.set(key, String(value)),
        );
        form.set("challenge", challenge);
        setChallenge("");
        startTransition(() => formAction(form));
      })}
      className="space-y-5 rounded-2xl border bg-white p-6 md:p-8"
      aria-busy={pending}
    >
      <h2 className="text-xl font-semibold">Confirmá tus datos</h2>
      <input type="hidden" {...register("request_key")} />
      <div>
        <label htmlFor="public-slot" className="mb-2 block text-sm font-medium">
          Horario disponible
        </label>
        <select
          id="public-slot"
          required
          {...register("starts_at")}
          className="min-h-12 w-full rounded-md border px-3 text-base"
        >
          {slots.map((slot) => (
            <option key={slot.starts_at} value={slot.starts_at}>
              {localTime(slot.starts_at, zone)}
            </option>
          ))}
        </select>
        {state.errors?.starts_at && (
          <p className="text-destructive mt-2 text-sm">
            {state.errors.starts_at[0]}
          </p>
        )}
      </div>
      {fields.map((field) => (
        <div key={field.name}>
          <label
            htmlFor={`public-${field.name}`}
            className="mb-2 block text-sm font-medium"
          >
            {field.label}
          </label>
          <Input
            id={`public-${field.name}`}
            type={field.type}
            required={field.name !== "customer_phone"}
            maxLength={field.max}
            aria-invalid={Boolean(state.errors?.[field.name])}
            aria-describedby={`public-${field.name}-error`}
            {...register(field.name)}
          />
          <p
            id={`public-${field.name}-error`}
            className="text-destructive mt-2 text-sm"
          >
            {state.errors?.[field.name]?.[0]}
          </p>
        </div>
      ))}
      <div className="absolute top-0 -left-[10000px]" aria-hidden="true">
        <label htmlFor="public-website">Dejá este campo vacío</label>
        <input
          id="public-website"
          tabIndex={-1}
          autoComplete="off"
          {...register("website")}
        />
      </div>
      <div className="bg-muted rounded-xl p-4">
        <h3 className="text-sm font-semibold">Política de cancelación</h3>
        <p className="mt-2 text-sm leading-6 break-words whitespace-pre-wrap">
          {policy}
        </p>
        <label className="mt-4 flex min-h-11 items-start gap-3 text-sm leading-6">
          <input
            type="checkbox"
            required
            className="mt-1 size-4 shrink-0"
            {...register("accept_policy")}
          />
          Leí y acepto la política de cancelación.
        </label>
        {state.errors?.accept_policy && (
          <p className="text-destructive text-sm">
            {state.errors.accept_policy[0]}
          </p>
        )}
      </div>
      <p className="text-muted-foreground text-xs leading-5">
        Usaremos estos datos para gestionar este turno. No te suscribimos a
        comunicaciones comerciales.
      </p>
      {siteKey && (
        <>
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
            onReady={() => setReady(true)}
          />
          <div ref={holder} />
        </>
      )}
      {state.message && (
        <p role="status" className="rounded-lg border p-4 text-sm leading-6">
          {state.message}
        </p>
      )}
      <Button
        type="submit"
        disabled={pending}
        className="min-h-12 w-full bg-[var(--public-primary)] text-[var(--public-primary-text)] hover:opacity-90"
      >
        {pending ? "Guardando tu reserva…" : "Solicitar reserva"}
      </Button>
    </form>
  );
}
