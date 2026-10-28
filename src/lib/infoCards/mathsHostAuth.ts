import { createHmac, timingSafeEqual } from "node:crypto";
export function mathsHostToken() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Maths host authentication is not configured");
  const time = String(Date.now());
  return `${time}.${createHmac("sha256", secret).update(`info-card-maths-host:${time}`).digest("hex")}`;
}
export function validMathsHostToken(value: string | null) {
  if (!value || !process.env.SESSION_SECRET) return false;
  const [time, signature, extra] = value.split(".");
  if (extra !== undefined || !/^\d+$/.test(time) || !/^[0-9a-f]{64}$/.test(signature ?? "") || Date.now() - Number(time) > 60000 || Number(time) > Date.now()) return false;
  const expected = createHmac("sha256", process.env.SESSION_SECRET).update(`info-card-maths-host:${time}`).digest("hex");
  return signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
