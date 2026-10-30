import "server-only";
import {
  createHmac,
  createHash,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
export const visitorCookie = "booking_visitor";
export const managementCookie = "booking_management";
const week = 7 * 86400000;
const sign = (value: string, secret: string) =>
  createHmac("sha256", secret).update(value).digest("hex");
export function mintVisitor(secret: string, now = Date.now()) {
  const value = `${randomUUID()}.${now}`;
  return `${value}.${sign(`visitor:${value}`, secret)}`;
}
export function verifyVisitor(
  value: string | undefined,
  secret: string,
  now = Date.now(),
): value is string {
  if (!value) return false;
  const match = /^([0-9a-f-]{36})\.(\d{13})\.([0-9a-f]{64})$/.exec(value);
  if (!match) return false;
  const issued = Number(match[2]);
  if (issued > now + 300000 || now - issued > week) return false;
  const expected = sign(`visitor:${match[1]}.${match[2]}`, secret);
  return timingSafeEqual(
    Buffer.from(match[3]!, "hex"),
    Buffer.from(expected, "hex"),
  );
}
export function visitorDigest(value: string, secret: string) {
  return sign(`bucket:${value}`, secret);
}
export function managementToken(
  slug: string,
  requestKey: string,
  visitor: string,
  secret: string,
) {
  return sign(`manage:${slug}:${requestKey}:${visitor}`, secret);
}
export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
