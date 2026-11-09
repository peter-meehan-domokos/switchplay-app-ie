// Navigation intent only. All roles, reads and writes remain server-authorised.
const key = "switchplay-group-login";
type Login = { actor: string; entered: string[] };
type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;
let fallback: Login | null = null;
function browserStorage(): Storage | undefined {
  try { return typeof window === "undefined" ? undefined : window.sessionStorage; } catch { return undefined; }
}
function read(storage?: Storage): Login | null {
  try {
    const value = JSON.parse(storage?.getItem(key) ?? "null");
    if (value && typeof value.actor === "string" && Array.isArray(value.entered) && value.entered.every((id: unknown) => typeof id === "string")) return value;
  } catch { /* Retain this tab's intent if browser storage is unavailable. */ }
  return fallback;
}
function write(value: Login, storage?: Storage) {
  fallback = value;
  try { storage?.setItem(key, JSON.stringify(value)); } catch { /* Optional tab storage. */ }
}
export function startGroupLogin(actor: string, storage = browserStorage()) {
  write({ actor, entered: [] }, storage);
}
export function needsGroupLoginDefault(actor: string, experienceId: string, storage = browserStorage()) {
  const login = read(storage);
  return login?.actor === actor && !login.entered.includes(experienceId);
}
export function acceptGroupLoginDefault(actor: string, experienceId: string, storage = browserStorage()) {
  const login = read(storage);
  if (login?.actor === actor && !login.entered.includes(experienceId)) write({ actor, entered: [...login.entered, experienceId] }, storage);
}
