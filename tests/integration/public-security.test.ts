import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ config: vi.fn() }));
vi.mock("@/lib/public-booking/config", () => ({
  publicBookingConfig: mocks.config,
}));
import {
  mintVisitor,
  verifyVisitor,
  visitorDigest,
  managementToken,
  hashToken,
} from "@/lib/public-booking/visitor";
import { verifyBookingChallenge } from "@/features/public-booking/captcha";
const secret = "a".repeat(64),
  visitor = "b".repeat(64);
beforeEach(() => {
  vi.resetAllMocks();
  mocks.config.mockReturnValue({
    local: false,
    origin: "https://reservas.example",
    siteKey: "site-test",
    captchaSecret: "secret-test",
  });
});
afterEach(() => vi.unstubAllGlobals());
describe("identidad anónima firmada y capacidad privada", () => {
  it("rechaza cookies alteradas, vencidas o emitidas muy en el futuro", () => {
    const now = Date.now(),
      value = mintVisitor(secret, now);
    expect(verifyVisitor(value, secret, now)).toBe(true);
    expect(
      verifyVisitor(
        value.slice(0, -1) + (value.endsWith("a") ? "b" : "a"),
        secret,
        now,
      ),
    ).toBe(false);
    expect(verifyVisitor(value, "b".repeat(64), now)).toBe(false);
    expect(verifyVisitor(value, secret, now + 8 * 86400000)).toBe(false);
    expect(verifyVisitor(mintVisitor(secret, now + 600000), secret, now)).toBe(
      false,
    );
  });
  it("separa visitante, tenant y clave de solicitud sin exponer el secreto", () => {
    const cookie = mintVisitor(secret);
    const digest = visitorDigest(cookie, secret),
      token = managementToken("negocio", "request", digest, secret);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(token).not.toBe(digest);
    expect(hashToken(token)).not.toBe(token);
    expect(token).not.toContain(secret);
    expect(managementToken("otro", "request", digest, secret)).not.toBe(token);
    expect(
      managementToken("negocio", "request", "c".repeat(64), secret),
    ).not.toBe(token);
  });
});
describe("Turnstile verificado en servidor", () => {
  it("solo omite desafío en localhost sin claves y falla cerrado sin configuración", async () => {
    mocks.config.mockReturnValue(null);
    expect(await verifyBookingChallenge("", visitor)).toBe(false);
    mocks.config.mockReturnValue({ local: false });
    expect(await verifyBookingChallenge("", visitor)).toBe(false);
    mocks.config.mockReturnValue({ local: true });
    expect(await verifyBookingChallenge("", visitor)).toBe(true);
  });
  it("comprueba success, hostname, acción y contexto del visitante", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        hostname: "reservas.example",
        action: "booking",
        cdata: visitor,
      }),
    });
    vi.stubGlobal("fetch", fetch);
    expect(await verifyBookingChallenge("challenge", visitor)).toBe(true);
    for (const changed of [
      { success: false },
      { hostname: "attacker.example" },
      { action: "other" },
      { cdata: "wrong" },
    ]) {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          hostname: "reservas.example",
          action: "booking",
          cdata: visitor,
          ...changed,
        }),
      });
      expect(await verifyBookingChallenge("challenge", visitor)).toBe(false);
    }
  });
  it("rechaza reuso, errores del proveedor, respuestas inválidas y tokens demasiado largos", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          hostname: "reservas.example",
          action: "booking",
          cdata: visitor,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: false }),
      })
      .mockRejectedValueOnce(new Error("network"));
    vi.stubGlobal("fetch", fetch);
    expect(await verifyBookingChallenge("once", visitor)).toBe(true);
    expect(await verifyBookingChallenge("once", visitor)).toBe(false);
    expect(await verifyBookingChallenge("another", visitor)).toBe(false);
    expect(await verifyBookingChallenge("x".repeat(2049), visitor)).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
