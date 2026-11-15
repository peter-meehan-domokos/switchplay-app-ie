/**
 * Same-tab "the signed-in person changed" signal. It carries no identity, credentials or personal data;
 * listeners must re-ask the server who is signed in. Publishing can never throw into authentication.
 */
export const AUTH_CHANGED_EVENT = "switchplay:auth-changed";
export function announceAuthChange(): void {
  try {
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT));
  } catch { /* a failed notification must never affect sign-in or sign-out */ }
}
export function onAuthChange(handler: () => void): () => void {
  window.addEventListener(AUTH_CHANGED_EVENT, handler);
  return () => window.removeEventListener(AUTH_CHANGED_EVENT, handler);
}
