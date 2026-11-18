import { createHash, createHmac, randomBytes } from "node:crypto";
export const randomEmailToken = () => randomBytes(32).toString("base64url");
export function tokenDigest(token: string) { return createHash("sha256").update(token).digest("hex"); }
export function protectedDigest(...parts: string[]) {
  const key = process.env.ACCOUNT_EMAIL_SECRET;
  if (!key || Buffer.byteLength(key) < 32) throw new Error("EMAIL_SECRET_REQUIRED");
  return createHmac("sha256", key).update(JSON.stringify(parts)).digest("hex");
}
export function requireEmailToken(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value)) throw new Error("INVALID_EMAIL_PROOF");
  return value;
}
