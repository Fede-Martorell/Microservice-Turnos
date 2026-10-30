import type { FormField } from "@/components/ui/action-form";
import type {
  Professional,
  Service,
  AvailabilityRule,
  AvailabilityException,
} from "@/types/catalog";
import type { OrganizationMember } from "@/types/database";
import { weekdays, minuteInput } from "./availability-schema";

export function professionalFields(
  services: Service[],
  selected: string[],
  members: OrganizationMember[],
  currentUser: string,
  profile?: Professional,
): FormField[] {
  return [
    {
      name: "name",
      label: "Nombre del profesional",
      required: true,
      maxLength: 100,
      value: profile?.name,
    },
    {
      name: "description",
      label: "Descripción",
      type: "textarea",
      maxLength: 2000,
      value: profile?.description,
    },
    {
      name: "photo_url",
      label: "Foto por URL HTTPS (opcional)",
      type: "url",
      maxLength: 2048,
      value: profile?.photo_url ?? "",
    },
    {
      name: "user_id",
      label: "Cuenta del negocio (opcional)",
      type: "select",
      value: profile?.user_id ?? "",
      options: [
        { value: "", label: "Sin cuenta · solo recurso de reserva" },
        ...members
          .filter(
            (member) => member.is_active || member.user_id === profile?.user_id,
          )
          .map((member) => ({
            value: member.user_id,
            label:
              member.user_id === currentUser
                ? "Tu cuenta"
                : `${member.role === "owner" ? "Propietario" : "Personal"} · ${member.user_id.slice(0, 8)}${member.is_active ? "" : " · Acceso suspendido"}`,
          })),
      ],
      hint: "No necesita cuenta para figurar en la agenda. Para agregar una persona nueva, guardá el perfil y generá una invitación.",
    },
    {
      name: "service_ids",
      label: "Servicios ofrecidos",
      type: "checklist",
      value: selected,
      options: services.map((service) => ({
        value: service.id,
        label: service.name + (service.is_active ? "" : " · Inactivo"),
      })),
    },
    {
      name: "is_active",
      label: "Profesional activo para reservas",
      type: "checkbox",
      value: profile?.is_active ?? true,
      hint: "El estado del recurso y su permiso de acceso al panel se administran por separado.",
    },
  ];
}
export function ruleFields(rule?: AvailabilityRule): FormField[] {
  return [
    {
      name: "weekday",
      label: "Día de la semana",
      type: "select",
      required: true,
      value: String(rule?.weekday ?? 1),
      options: weekdays.map((label, index) => ({
        value: String(index),
        label,
      })),
    },
    {
      name: "kind",
      label: "Tipo de intervalo",
      type: "select",
      value: rule?.kind ?? "working",
      options: [
        { value: "working", label: "Horario de trabajo" },
        { value: "break", label: "Descanso" },
      ],
    },
    {
      name: "start",
      label: "Hora de inicio",
      required: true,
      value: minuteInput(rule?.start_minute ?? 540),
      pattern: "(?:[01][0-9]|2[0-3]):[0-5][0-9]",
      hint: "Formato HH:mm en la zona horaria del negocio.",
    },
    {
      name: "end",
      label: "Hora de fin",
      required: true,
      value: minuteInput(rule?.end_minute ?? 1080),
      pattern: "(?:(?:[01][0-9]|2[0-3]):[0-5][0-9]|24:00)",
      hint: "Hasta 24:00. Para cruzar medianoche, creá un tramo en cada día.",
    },
  ];
}
export function exceptionFields(
  exception?: AvailabilityException,
): FormField[] {
  return [
    {
      name: "starts_on",
      label: "Desde",
      type: "date",
      required: true,
      value: exception?.starts_on,
    },
    {
      name: "ends_on",
      label: "Hasta (inclusive)",
      type: "date",
      required: true,
      value: exception?.ends_on,
    },
    {
      name: "kind",
      label: "Motivo del bloqueo",
      type: "select",
      value: exception?.kind ?? "blocked",
      options: [
        { value: "blocked", label: "Bloqueo administrativo" },
        { value: "vacation", label: "Vacaciones" },
        { value: "holiday", label: "Día no laborable" },
      ],
    },
    {
      name: "start",
      label: "Hora inicial (opcional)",
      value:
        exception?.start_minute === null || !exception
          ? ""
          : minuteInput(exception.start_minute),
      hint: "Dejá ambas horas vacías para bloquear días completos.",
    },
    {
      name: "end",
      label: "Hora final (opcional)",
      value:
        exception?.end_minute === null || !exception
          ? ""
          : minuteInput(exception.end_minute),
    },
    {
      name: "reason",
      label: "Observaciones (opcional)",
      type: "textarea",
      maxLength: 500,
      value: exception?.reason,
      hint: "No incluyas datos personales sensibles.",
    },
  ];
}
