// New credentials only. Existing login deliberately does not use these rules.
export function normaliseAccountEmail(value: unknown): string {
  if (typeof value !== "string") throw new Error("INVALID_EMAIL");
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("INVALID_EMAIL");
  return email;
}
export function validateNewPassword(value: unknown): string {
  if (typeof value !== "string" || [...value].length < 12 || Buffer.byteLength(value, "utf8") > 72) throw new Error("INVALID_NEW_PASSWORD");
  return value;
}
export function validateCoreCredentials(input: { username: unknown; email: unknown; password: unknown }) {
  if (typeof input.username !== "string" || !/^[A-Za-z0-9_-]{3,30}$/.test(input.username.trim())) throw new Error("INVALID_USERNAME");
  return { username: input.username.trim(), email: normaliseAccountEmail(input.email), password: validateNewPassword(input.password) };
}
