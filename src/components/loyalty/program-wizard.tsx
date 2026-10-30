"use client";
import { useState } from "react";
import { ActionForm, type FormField } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { saveLoyaltyProgramAction } from "@/features/loyalty/actions";
import type { LoyaltyConfig } from "@/features/loyalty/schema";
export function ProgramWizard({
  org,
  config,
  services,
  today,
  lastDay,
}: {
  org: string;
  config: LoyaltyConfig;
  services: { id: string; name: string; is_active: boolean }[];
  today: string;
  lastDay: string;
}) {
  const [mode, setMode] = useState<"visits" | "points">(
    config.program?.mode ?? "visits",
  );
  const [step, setStep] = useState(1);
  const [example, setExample] = useState(false);
  const activeServices = services.filter((s) => s.is_active);
  const selected = example
    ? activeServices.slice(0, 2).map((s) => s.id)
    : config.services
        .filter((s) =>
          services.some((v) => v.id === s.service_id && v.is_active),
        )
        .map((s) => s.service_id);
  const fields: FormField[] = [
    {
      name: "name",
      label: "Nombre del programa",
      value: config.program?.name ?? "Mi programa de beneficios",
      required: true,
      maxLength: 100,
    },
    {
      name: "starts_on",
      label: "Primer día de vigencia",
      type: "date",
      value: today,
      required: true,
    },
    {
      name: "ends_on",
      label: "Último día de vigencia (inclusive)",
      type: "date",
      value: lastDay,
      required: true,
    },
    {
      name: "conditions",
      label: "Condiciones del programa",
      type: "textarea",
      value:
        config.rule?.conditions ??
        "Se acreditan beneficios por servicios participantes completados. El canje se coordina con el negocio.",
      required: true,
      maxLength: 2000,
    },
    {
      name: "expire_days",
      label: `Vencimiento de ${mode === "visits" ? "visitas" : "puntos"} desde cada acreditación (días)`,
      type: "number",
      min: 1,
      max: 3650,
      value: config.rule?.expire_days ? String(config.rule.expire_days) : "",
      hint: "Vacío: sin vencimiento. Los créditos anteriores conservan su vigencia original.",
    },
    {
      name: "reset_mode",
      label: "Qué pasa al canjear",
      type: "select",
      value:
        mode === "points"
          ? "subtract"
          : (config.rule?.reset_mode ?? "subtract"),
      options:
        mode === "points"
          ? [
              {
                value: "subtract",
                label: "Descontar el costo y conservar el resto",
              },
            ]
          : [
              {
                value: "subtract",
                label: "Restar las visitas del costo y conservar el resto",
              },
              {
                value: "reset",
                label: "Reiniciar a cero, perdiendo las visitas que sobren",
              },
            ],
      hint: "El costo y beneficio se definen en cada recompensa.",
    },
    ...(mode === "visits"
      ? [
          {
            name: "service_ids",
            label: "Servicios participantes",
            type: "checklist" as const,
            value: selected,
            options: activeServices.map((s) => ({
              value: s.id,
              label: s.name,
            })),
            hint: "Cada reserva completada acredita una visita. Los servicios inactivos quedan fuera de las reglas nuevas; se conservan los créditos anteriores.",
          },
        ]
      : activeServices.map((s, index) => ({
          name: `earn_${s.id}`,
          label: `Puntos: ${s.name}`,
          type: "number" as const,
          value: String(
            example
              ? index === 0
                ? 1
                : index === 1
                  ? 3
                  : 0
              : (config.services.find((v) => v.service_id === s.id)?.points ??
                  0),
          ),
          required: true,
          min: 0,
          max: 10000,
          hint: "0: no participa. De 1 a 10000: puntos por reserva completada.",
        }))),
    {
      name: "is_active",
      label: "Activar el programa al guardar",
      type: "checkbox",
      value: config.program?.is_active ?? false,
      hint: "Si queda pausado, se conserva el saldo e historial; no se acredita ni se canjea.",
    },
  ];
  return (
    <div className="space-y-6">
      <ol
        className="flex flex-wrap gap-3 text-sm"
        aria-label="Pasos de configuración"
      >
        <li className={step === 1 ? "font-semibold" : ""}>
          1. Elegí cómo acumular
        </li>
        <li className={step === 2 ? "font-semibold" : ""}>
          2. Definí las reglas
        </li>
        <li>3. Creá tus recompensas</li>
      </ol>
      {step === 1 ? (
        <>
          <h2 className="text-xl font-semibold">
            El negocio decide el beneficio
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                {
                  value: "visits",
                  title: "Tarjeta de visitas",
                  description:
                    "Una visita por reserva completada. Ejemplo editable: una recompensa cada 10 visitas.",
                },
                {
                  value: "points",
                  title: "Puntos por servicio",
                  description:
                    "Cada servicio puede dar una cantidad diferente. Ejemplo editable: Consulta 1 punto, Sesión 3 puntos.",
                },
              ] as const
            ).map((option) => (
              <label
                className="flex gap-3 rounded-xl border p-5 text-sm leading-6"
                key={option.value}
              >
                <input
                  type="radio"
                  name="mode"
                  className="mt-1"
                  value={option.value}
                  checked={mode === option.value}
                  disabled={
                    config.mode_locked && config.program?.mode !== option.value
                  }
                  onChange={() => setMode(option.value)}
                />
                <span>
                  <strong>{option.title}</strong>
                  <span className="mt-2 block">{option.description}</span>
                </span>
              </label>
            ))}
          </div>
          {config.mode_locked && (
            <p className="text-muted-foreground text-sm">
              La modalidad se conserva porque ya hay movimientos. Podés
              modificar las reglas futuras.
            </p>
          )}
          <div className="bg-muted space-y-3 rounded-xl p-5 text-sm leading-6">
            <p>
              Se acredita al completar el servicio. Cancelar o marcar ausencia
              no acredita; no se recorren reservas ya completadas para dar
              créditos retroactivos.
            </p>
            <p>
              Al modificar reglas se crea una versión nueva. Los créditos y
              vencimientos anteriores se conservan.
            </p>
            <p>
              Podés ofrecer un servicio, descuento o beneficio descriptivo. Para
              estimar su costo comercial, dividí tu costo interno del beneficio
              por las visitas o puntos necesarios; también considerá la
              frecuencia de canje. El sistema no interpreta puntos como dinero.
            </p>
            <p>
              El cliente consulta su tarjeta privada. El propietario registra el
              canje y puede anularlo con motivo, conservando el historial.
              Pausar detiene nuevas acreditaciones y canjes.
            </p>
          </div>
          <Button onClick={() => setStep(2)}>Configurar reglas</Button>
        </>
      ) : (
        <>
          <Button variant="outline" onClick={() => setStep(1)}>
            ← Revisar modalidad
          </Button>
          <p className="text-muted-foreground text-sm">
            Fechas en la zona del negocio. Elegí al menos un servicio; al
            guardar podrás crear recompensas y definir su costo.
          </p>
          {!example && (
            <Button variant="outline" onClick={() => setExample(true)}>
              Cargar ejemplo editable de servicios
            </Button>
          )}
          <p className="text-muted-foreground text-xs">
            Cargar el ejemplo o cambiar de modalidad reemplaza los datos sin
            guardar. Revisá los valores antes de guardar.
          </p>
          <ActionForm
            key={`${config.program?.version ?? 0}-${mode}-${example}`}
            requiresModule="loyalty"
            action={saveLoyaltyProgramAction.bind(
              null,
              org,
              config.program?.version ?? null,
              mode,
            )}
            fields={fields}
            submitLabel="Guardar reglas"
          />
        </>
      )}
    </div>
  );
}
