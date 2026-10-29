import { libraryFetch, workingDeckHref } from "@/components/library/libraryClient";
import { workingRequest } from "@/components/decks/updateClient";
import type { LibraryEntry } from "@/lib/cards/libraryProjection";
import type { AreaDeckDestination, LibraryDeckDestination, ItemDeckContext } from "@/lib/frameworks/destinations";
import { withProgressReturn } from "@/lib/frameworks/progressNavigation";

// Shared Area/Item selection commands, with per-dialog state and actor-bound reads.
// These are explicit navigation actions, never part of destination discovery.
export async function progressLibraryHref(actor: string, entry: LibraryDeckDestination | ItemDeckContext,
  frameworkId: string, areaId: string, signal: AbortSignal, cardTemplateId?: string) {
  const auth = await libraryFetch<{ user: { id: string } | null }>("/api/auth/me", signal);
  if (auth.user?.id !== actor) throw new Error("Your sign-in changed. Reload Progress before continuing.");
  if (entry.kind !== "library") throw new Error("This is not a Library destination.");
  const detail = await libraryFetch<LibraryEntry>(`/api/library/decks/${encodeURIComponent(entry.deckTemplateId)}`, signal);
  if (detail.availability !== "available" || detail.deckTemplateId !== entry.deckTemplateId) throw new Error("This public Deck is unavailable. Refresh Decks before continuing.");
  if (JSON.stringify(detail.manifest) !== JSON.stringify(entry.manifest)) throw new Error("This publication changed. Refresh Decks and review it before continuing.");
  if (cardTemplateId && !detail.manifest.cards.some((card) => card.cardTemplateId === cardTemplateId && "cardVersion" in entry && card.version === entry.cardVersion))
    throw new Error("This Card is no longer available in the selected publication. Refresh Cards before continuing.");
  const query = cardTemplateId && "cardVersion" in entry ? `?${new URLSearchParams({ openCard: cardTemplateId, cardVersion: String(entry.cardVersion) })}` : "";
  return withProgressReturn(`/library/${encodeURIComponent(entry.deckTemplateId)}${query}`, { frameworkId, areaId });
}

export async function progressWorkingHref(actor: string, entry: AreaDeckDestination | ItemDeckContext,
  current: AreaDeckDestination | ItemDeckContext | undefined, frameworkId: string, areaId: string, restore: boolean, cardTemplateId?: string) {
  if (entry.kind === "library" || !current || current.kind === "library" || current.availability !== "available" || current.kind !== entry.kind
    || current.membershipRevision !== entry.membershipRevision || current.adoptedDeckVersion !== entry.adoptedDeckVersion
    || (cardTemplateId && (!("cardVersion" in entry) || !("cardVersion" in current) || entry.cardVersion !== current.cardVersion)))
    throw new Error(cardTemplateId ? "This Deck or Card changed or is unavailable. Refresh the list before opening it."
      : "This Deck changed or is unavailable. Refresh the list before opening it.");
  if (restore !== (entry.kind === "archived")) throw new Error("Archived Decks require explicit Restore and open.");
  if (restore) await workingRequest(actor, `/api/decks-data/${encodeURIComponent(entry.deckTemplateId)}`, "PATCH",
    { type: "restore", membershipRevision: entry.membershipRevision });
  const href = workingDeckHref(entry.deckTemplateId, cardTemplateId);
  return withProgressReturn(cardTemplateId && "cardVersion" in entry ? `${href}&cardVersion=${entry.cardVersion}` : href,
    { frameworkId, areaId, restored: restore });
}
