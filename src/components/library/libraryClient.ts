import type { LibraryViewerStatusDTO } from "@/lib/cards/libraryReadModels";

export class LibraryRequestError extends Error {
  constructor(readonly status: number, readonly code: string) { super(status === 401 ? "Please sign in again." : code.includes("MEMBERSHIP") ? "Your Deck membership changed. Reload Library before continuing." : code.includes("FORBIDDEN") || code.includes("UNAVAILABLE") ? "This Deck is currently unavailable. Your personal state is retained." : "Unable to complete the request. Please retry or reload Library."); }
}
export async function libraryFetch<T>(url: string, signal: AbortSignal, body?: unknown, viewerUserId?: string): Promise<T> {
  const response = await fetch(url, { method: body === undefined ? "GET" : "POST", signal, cache: "no-store",
    headers: { "Content-Type": "application/json", ...(viewerUserId ? { "X-Library-Viewer": viewerUserId } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const result = await response.json();
  if (!response.ok) throw new LibraryRequestError(response.status, result.code ?? result.error ?? "REQUEST_FAILED");
  return result;
}
export function deckEntryAction(state: LibraryViewerStatusDTO["decks"][number]["state"] | undefined) {
  return state === "active" ? "Open in My Decks" : state === "archived" ? "Restore to My Decks" : "Add to My Decks";
}
export function workingDeckHref(deckTemplateId: string, cardTemplateId?: string) {
  const query = new URLSearchParams({ openDeck: deckTemplateId });
  if (cardTemplateId) query.set("openCard", cardTemplateId);
  return `/decks?${query}`;
}
