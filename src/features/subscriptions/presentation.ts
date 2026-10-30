export function formatTimestamp(instant: string, timezone: string) {
  return new Date(instant).toLocaleString("es-AR", {
    timeZone: timezone,
    hourCycle: "h23",
  });
}
export function localDay(instant: string, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(instant));
}
export function lastDay(endsAt: string, timezone: string) {
  return localDay(
    new Date(new Date(endsAt).getTime() - 1).toISOString(),
    timezone,
  );
}
export function periodText(startsAt: string, endsAt: string, timezone: string) {
  return `${localDay(startsAt, timezone)} al ${lastDay(endsAt, timezone)} (${timezone})`;
}
