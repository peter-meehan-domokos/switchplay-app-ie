/**
 * Puckle pre-launch access decision. Pure: environment and account email in, decision out.
 *
 * PUCKLE_PRELAUNCH_MODE=1 turns the pre-launch experience on for the Puckle website only.
 * PUCKLE_PRELAUNCH_ACCESS is an optional comma-separated list of account emails that keep the normal
 * platform while pre-launch mode is on. Empty or absent means nobody is exempt.
 * Switchplay and Strat17 are never affected.
 */
import type { SiteId } from "./sites/siteResolver";

/** Any environment object; only the two PUCKLE_PRELAUNCH_* keys are read. */
export type PrelaunchEnv = Readonly<Record<string, string | undefined>>;
export type PrelaunchAccess = "normal" | "prelaunch";

export const isPrelaunchMode = (env: PrelaunchEnv = process.env): boolean => env.PUCKLE_PRELAUNCH_MODE?.trim() === "1";

/** Trimmed, lower-cased, empty entries dropped. */
export function prelaunchAccessList(env: PrelaunchEnv = process.env): readonly string[] {
  return (env.PUCKLE_PRELAUNCH_ACCESS ?? "").split(",").map(entry => entry.trim().toLowerCase()).filter(entry => entry.length > 0);
}

/**
 * Which experience an account gets. `email` must come from the verified session or the account record,
 * never from request input. A missing email can never be on the list.
 */
export function prelaunchAccessFor(input: { site: SiteId; email: string | null | undefined }, env: PrelaunchEnv = process.env): PrelaunchAccess {
  if (input.site !== "puckle" || !isPrelaunchMode(env)) return "normal";
  const email = input.email?.trim().toLowerCase();
  return email && prelaunchAccessList(env).includes(email) ? "normal" : "prelaunch";
}
