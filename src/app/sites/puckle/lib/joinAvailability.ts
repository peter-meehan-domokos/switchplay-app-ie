/**
 * Public Join stays closed on a production deployment until the founder explicitly opens it
 * (reviewed publishing permissions and final verification must come first). Fail closed.
 */
export function isJoinOpen(env: { NODE_ENV?: string; PUCKLE_JOIN_ENABLED?: string } = process.env): boolean {
  return env.NODE_ENV !== "production" || env.PUCKLE_JOIN_ENABLED === "1";
}
