import type { AppointmentStatus } from "@/types/appointments";
export const statusLabels: Record<AppointmentStatus, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  completed: "Completada",
  canceled: "Cancelada",
  no_show: "Ausente",
};
export const transitions: Record<AppointmentStatus, AppointmentStatus[]> = {
  pending: ["confirmed", "canceled"],
  confirmed: ["completed", "canceled", "no_show"],
  completed: [],
  canceled: [],
  no_show: [],
};
export function localDay(zone: string, instant = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const value = (key: string) => parts.find((part) => part.type === key)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}
export function addDays(day: string, count: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}
export function localTime(instant: string, zone: string) {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "shortOffset",
  }).format(new Date(instant));
}
