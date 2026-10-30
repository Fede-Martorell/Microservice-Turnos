export type OrganizationRole = "owner" | "staff";
export type OrganizationPermission =
  | "organization:read"
  | "organization:update"
  | "members:read"
  | "audit:read"
  | "catalog:manage";

const permissions: Record<OrganizationRole, readonly OrganizationPermission[]> =
  {
    owner: [
      "organization:read",
      "organization:update",
      "members:read",
      "audit:read",
      "catalog:manage",
    ],
    staff: ["organization:read"],
  };

export function hasOrganizationPermission(
  role: string,
  permission: OrganizationPermission,
) {
  return (
    Object.hasOwn(permissions, role) &&
    permissions[role as OrganizationRole].includes(permission)
  );
}
