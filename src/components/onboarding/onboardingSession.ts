/**
 * "I dismissed this reminder" for the current browser session only, kept separately for each account.
 * sessionStorage ends with the tab/browser session, so a later session shows an outstanding reminder again;
 * nothing is stored on the server and nothing is permanent. Storage may be blocked or full: then the
 * reminder simply behaves as before (reappears on reload) and nothing breaks.
 */
const key = (actorId: string) => `puckle:onboarding:reminder-dismissed:${actorId}`;
export function isReminderDismissed(actorId: string, storage: Pick<Storage, "getItem"> | undefined = safeStorage()): boolean {
  try { return storage?.getItem(key(actorId)) === "1"; } catch { return false; }
}
export function rememberReminderDismissed(actorId: string, storage: Pick<Storage, "setItem"> | undefined = safeStorage()): void {
  try { storage?.setItem(key(actorId), "1"); } catch { /* blocked or full: dismissal lasts until reload */ }
}
function safeStorage(): Storage | undefined {
  try { return typeof window === "undefined" ? undefined : window.sessionStorage; } catch { return undefined; }
}
