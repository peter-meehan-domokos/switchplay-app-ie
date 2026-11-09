import type { preparePersonalDeck, openPreparedPersonalDeck } from "./preparation";
import type { Deck } from "@/components/decks/types";
import { workingRequest } from "@/components/decks/updateClient";
import { captureCardPreparation, acceptPersonalPreparation } from "./preparationClient";
import { personalPreparationIdentity } from "./preparationIdentity";
import { workingCardStore } from "./workingCardStore";
import { hasPreparedMedia, retainedMediaPreview } from "../mediaCollection/controller";
import { hasPreparedReflection } from "../reflections/controller";
type Prepared = Awaited<ReturnType<typeof preparePersonalDeck>>;
type Capture = ReturnType<typeof captureCardPreparation>;
type Entry = { prepared: Prepared; capture: Capture; at: number };
type Requester = typeof workingRequest;
// Read results and promises only; domain controllers remain the source owners.
// No mounted scene, player, decoded image or persistent private cache is kept.
const entries = new Map<string, Entry>(), pending = new Map<string, Promise<Entry>>();
const key = (actor: string, id: string) => JSON.stringify([actor, id]);
function complete(entry: Entry) {
  const actor = entry.capture.actor;
  return workingCardStore.session(actor) === entry.capture.session && entry.prepared.deck.cards.every(card =>
    hasPreparedMedia({ kind: "owner", viewerUserId: actor, cardTemplateId: card.id })
    && hasPreparedReflection({ viewerUserId: actor, cardTemplateId: card.id, view: { kind: "personal" } }));
}
function current(entry: Entry) {
  return Date.now() - entry.at < 60_000 && entry.prepared.deck.cards.every(card =>
    retainedMediaPreview({ kind: "owner", viewerUserId: entry.capture.actor, cardTemplateId: card.id }).isFresh());
}
export function preparePersonalIntroduction(actor: string, id: string, expected?: Deck, request: Requester = workingRequest): Promise<Entry> {
  const k = key(actor, id), known = entries.get(k);
  if (pending.has(k)) return pending.get(k)!;
  if (known && complete(known) && current(known) && (!expected || personalPreparationIdentity(expected) === personalPreparationIdentity(known.prepared.deck))) return Promise.resolve(known);
  const capture = captureCardPreparation(actor), at = Date.now();
  const promise = request<Prepared>(actor, `/api/decks-data/${encodeURIComponent(id)}/preparation`).then(prepared => {
    acceptPersonalPreparation(capture, prepared);
    const entry = { prepared, capture, at }; entries.set(k, entry); return entry;
  }).finally(() => { if (pending.get(k) === promise) pending.delete(k); });
  pending.set(k, promise); return promise;
}
export async function openPersonalPreparation(actor: string, id: string, body: { localDate: string; cardTemplateId?: string; expectedCardVersion?: number }, request: Requester = workingRequest): Promise<Entry> {
  const k = key(actor, id), session = workingCardStore.session(actor);
  // Joining an introduction does not cancel/restart its already useful read.
  const held = pending.get(k);
  let known = entries.get(k);
  if (held) { try { known = await held; } catch { /* Actual entry can retry a failed speculative read. */ } }
  if (workingCardStore.session(actor) !== session) throw Error("The signed-in account changed. Reopen My Decks.");
  if (known && !complete(known)) known = undefined;
  const capture = captureCardPreparation(actor), at = Date.now();
  const value = await request<Awaited<ReturnType<typeof openPreparedPersonalDeck>>>(actor, `/api/decks-data/${encodeURIComponent(id)}/preparation`, "POST",
    { ...body, ...(known ? { preparedComposition: personalPreparationIdentity(known.prepared.deck) } : {}) });
  let entry: Entry;
  if ("reusePrepared" in value && value.reusePrepared) {
    if (!known || personalPreparationIdentity(value.deck) !== personalPreparationIdentity(known.prepared.deck)) throw Error("Deck preparation changed. Retry opening.");
    entry = { at: known.at, capture: known.capture, prepared: { ...value, contributions: known.prepared.contributions,
      deck: { ...value.deck, preparedAssessments: known.prepared.deck.preparedAssessments } } };
    // Keep the same compact Card media projection as a cold composed read.
    // The actual-open DTO can contain legacy owner history; the Gallery still
    // retrieves that history on demand. Prefer the current domain window.
    for (const card of entry.prepared.deck.cards) {
      const page = retainedMediaPreview({ kind: "owner", viewerUserId: actor, cardTemplateId: card.id }).snapshot().page!;
      const keep = (source: string, id: string) => page.items.some(item => item.source.kind === "personal" && item.source.cardTemplateId === source && item.source.mediaItemId === id);
      card.mediaItems = card.mediaItems.filter(item => keep(card.id, item.id));
      card.personalHistory = card.personalHistory?.map(part => ({ ...part, mediaItems: part.mediaItems.filter(item => keep(part.cardTemplateId, item.id)) }));
    }
  } else entry = { capture, prepared: value, at };
  // Revalidate before retaining an acknowledgement from an older account.
  acceptPersonalPreparation(entry.capture, entry.prepared); entries.set(k, entry);
  if (!current(entry)) void preparePersonalIntroduction(actor, id, entry.prepared.deck, request).catch(() => {});
  return entry;
}
workingCardStore.onClear(actor => {
  for (const k of entries.keys()) if (JSON.parse(k)[0] === actor) entries.delete(k);
  for (const k of pending.keys()) if (JSON.parse(k)[0] === actor) pending.delete(k);
});
