/** Data contract only. No publication enforcement or existing-user writes in Phase 1. */
export type UserPermissions = { publicPublishing: boolean };
export function newAccountPermissions(): UserPermissions { return { publicPublishing: false }; }
export function parseUserPermissions(value: unknown): UserPermissions {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || typeof (value as UserPermissions).publicPublishing !== "boolean"
    || Object.keys(value).some(key => key !== "publicPublishing")) throw new Error("INVALID_USER_PERMISSIONS");
  return { publicPublishing: (value as UserPermissions).publicPublishing };
}
