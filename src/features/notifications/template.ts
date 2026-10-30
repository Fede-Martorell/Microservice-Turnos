import { z } from "zod";
import { formatMoney } from "@/lib/utils/money";
export const messageSchema = z.object({
  from: z.string().max(254),
  to: z.email(),
  subject: z.string().max(200),
  text: z.string().max(12000),
  html: z.string().max(20000),
});
export type EmailMessage = z.infer<typeof messageSchema>;
export const notificationClaimSchema = z.object({
  id: z.uuid(),
  claim_token: z.uuid(),
  kind: z.enum(["created", "confirmed", "canceled", "rescheduled", "reminder"]),
  snapshot: z.object({
    organization_name: z.string(),
    slug: z.string(),
    customer_name: z.string(),
    customer_email: z.email(),
    service_name: z.string(),
    staff_name: z.string(),
    starts_at: z.iso.datetime({ offset: true }),
    ends_at: z.iso.datetime({ offset: true }),
    timezone: z.string(),
    status: z.string(),
    price_minor: z.number(),
    currency: z.string(),
    contact_email: z.string(),
    contact_phone: z.string(),
  }),
  message: messageSchema.nullable(),
  access: z
    .object({
      request_key: z.uuid(),
      visitor: z.string().regex(/^[0-9a-f]{64}$/),
      token_hash: z.string().regex(/^[0-9a-f]{64}$/),
    })
    .nullable(),
});
export type NotificationClaim = z.infer<typeof notificationClaimSchema>;
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function buildNotificationMessage(
  job: NotificationClaim,
  from: string,
  managementLink: string | null,
): EmailMessage {
  const s = job.snapshot;
  const titles = {
    created:
      s.status === "confirmed"
        ? "Tu reserva está confirmada"
        : "Recibimos tu solicitud de reserva",
    confirmed: "Tu reserva está confirmada",
    canceled: "Tu reserva fue cancelada",
    rescheduled: "Tu reserva fue reprogramada",
    reminder: "Recordatorio de tu próxima reserva",
  };
  const title = titles[job.kind];
  const when = new Intl.DateTimeFormat("es-AR", {
    hourCycle: "h23",
    dateStyle: "full",
    timeStyle: "short",
    timeZone: s.timezone,
  }).format(new Date(s.starts_at));
  const lines = [
    title,
    `Hola, ${s.customer_name}.`,
    `${s.organization_name} · ${s.service_name}`,
    `Fecha y hora: ${when} (${s.timezone}).`,
    `Profesional: ${s.staff_name}.`,
    ...(s.status === "pending" && job.kind !== "canceled"
      ? ["Tu solicitud está pendiente de confirmación por el negocio."]
      : []),
    `Precio acordado: ${formatMoney(s.price_minor, s.currency)} ${s.currency}. Este aviso no indica un pago registrado.`,
    ...(managementLink
      ? [
          `Consultá o gestioná este turno desde tu enlace privado: ${managementLink}`,
          "El enlace permite administrar esta reserva. No lo compartas.",
        ]
      : ["Para consultar o modificar este turno, comunicate con el negocio."]),
    ...(s.contact_email ? [`Email del negocio: ${s.contact_email}`] : []),
    ...(s.contact_phone ? [`Teléfono del negocio: ${s.contact_phone}`] : []),
    "Este es un aviso transaccional sobre tu turno; no es una suscripción a marketing.",
  ];
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#f6f8f4;color:#243329;font-family:Arial,sans-serif"><main style="max-width:600px;margin:24px auto;padding:24px;background:white;border:1px solid #dde4dc;border-radius:12px"><h1 style="font-size:24px">${escapeHtml(title)}</h1>${lines
    .slice(1)
    .map(
      (line) =>
        `<p style="font-size:15px;line-height:1.6;overflow-wrap:anywhere">${managementLink && line.startsWith("Consultá o gestioná") ? `<a href="${escapeHtml(managementLink)}" style="color:#355741">Consultar o gestionar mi reserva</a>` : escapeHtml(line)}</p>`,
    )
    .join("")}</main></body></html>`;
  return messageSchema.parse({
    from,
    to: s.customer_email,
    subject: `${title} · ${s.organization_name}`
      .slice(0, 200)
      .replace(/[\r\n]/g, " "),
    text: lines.join("\n\n"),
    html,
  });
}
