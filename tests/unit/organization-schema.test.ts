import { describe, expect, it } from "vitest";
import {
  organizationSchema,
  reservedSlugs,
} from "@/features/organizations/schema";
import { hasOrganizationPermission } from "@/lib/permissions/organizations";
import { loginSchema, registrationSchema } from "@/lib/auth/schema";

const input = {
  name: "Estudio Centro",
  slug: "estudio-centro",
  description: "",
  timezone: "America/Argentina/Buenos_Aires",
  currency: "ARS",
};
describe("validación de entrada de organizaciones", () => {
  it("acepta organización genérica, zona IANA y UTC", () => {
    expect(organizationSchema.safeParse(input).success).toBe(true);
    expect(
      organizationSchema.safeParse({
        ...input,
        timezone: "UTC",
        currency: "USD",
      }).success,
    ).toBe(true);
  });
  it("rechaza identificadores ambiguos o reservados", () => {
    for (const slug of [
      ...reservedSlugs,
      "CON MAYUSCULAS",
      "con_espacios",
      "-inicio",
      "doble--guion",
      "fin-",
      "ab",
      "a".repeat(64),
    ])
      expect(organizationSchema.safeParse({ ...input, slug }).success).toBe(
        false,
      );
  });
  it("rechaza zona inexistente y moneda mal formada", () => {
    expect(
      organizationSchema.safeParse({ ...input, timezone: "Mars/Base" }).success,
    ).toBe(false);
    expect(
      organizationSchema.safeParse({ ...input, currency: "$" }).success,
    ).toBe(false);
  });
});
describe("permisos por membresía", () => {
  it("staff solo tiene lectura del negocio y owner puede configurar", () => {
    expect(hasOrganizationPermission("staff", "organization:read")).toBe(true);
    for (const permission of [
      "organization:update",
      "members:read",
      "audit:read",
    ] as const)
      expect(hasOrganizationPermission("staff", permission)).toBe(false);
    expect(hasOrganizationPermission("owner", "organization:update")).toBe(
      true,
    );
    expect(hasOrganizationPermission("owner", "audit:read")).toBe(true);
  });
  it("roles desconocidos, prototipos y superadmin autodeclarado no conceden acceso", () => {
    for (const role of ["admin", "superadmin", "constructor", "__proto__", ""])
      expect(hasOrganizationPermission(role, "organization:read")).toBe(false);
  });
});
describe("credenciales", () => {
  it("normaliza el email sin modificar la contraseña", () => {
    expect(
      loginSchema.parse({
        email: "  PERSONA@example.com ",
        password: "  frase larga  ",
      }),
    ).toEqual({ email: "persona@example.com", password: "  frase larga  " });
  });
  it("exige contraseña larga al registrarse y no acepta longitudes ilimitadas", () => {
    expect(
      registrationSchema.safeParse({
        email: "persona@example.com",
        password: "corta",
      }).success,
    ).toBe(false);
    expect(
      registrationSchema.safeParse({
        email: "persona@example.com",
        password: "una frase larga y segura",
      }).success,
    ).toBe(true);
    expect(
      loginSchema.safeParse({
        email: "persona@example.com",
        password: "a".repeat(129),
      }).success,
    ).toBe(false);
  });
});
