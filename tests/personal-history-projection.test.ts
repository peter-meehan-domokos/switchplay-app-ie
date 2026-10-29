import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildCardLayout, withCardMediaItems } from "../src/components/cards/cardLayout";
import BackCardExternalComment from "../src/components/decks/BackCardExternalComment";
import BackCardMediaCarousel from "../src/components/decks/BackCardMediaCarousel";
import { visiblePersonalMedia, personalMediaKey } from "../src/lib/cards/personalHistoryProjection";
import { WorkingCardStore } from "../src/lib/cards/workingCardStore";
import type { WeeklyCard } from "../src/components/decks/types";

test("working presentation renders original-context history while media mutations stay on current data", () => {
  const media = { id: "source-image", mediaType: "image" as const, provider: "cloudflare-r2" as const,
    assetId: "source-key", src: "https://example.invalid/source.png", description: "Earlier evidence" };
  const card: WeeklyCard = { id: "fork", label: "Card 1", targetDate: "", intro: { title: "Practice", description: null, mediaItem: null },
    steps: [], signals: [], reflection: "Current", mediaItems: [], chats: [], personalHistory: [
      { cardTemplateId: "fork", currentAdoptedCardTemplateVersion: 1, eventVersionAttribution: "not-recorded", tests: [], chats: [], mediaItems: [] },
      { cardTemplateId: "source", currentAdoptedCardTemplateVersion: 3, eventVersionAttribution: "not-recorded",
        tests: [{ id: "test", date: "2026-01-01", result: true, createdAt: "2026-01-01T00:00:00Z" }],
        chats: [{ id: "chat", deckTemplateId: "original-deck", comments: [{ id: "comment", creatorId: "coach", createdAt: "2026-01-01", text: "Original feedback", isRetained: true }] }], mediaItems: [media] },
    ] };
  const layout = buildCardLayout(card, { currentUserId: "alice", users: [{ id: "coach", name: "Coach" }] });
  const historicalMedia = { ...media, sourceCardTemplateId: "source", historyReadOnly: true as const };
  assert.deepEqual(layout.mediaItems, []); assert.deepEqual(layout.backMediaItems, [historicalMedia]);
  assert.equal(layout.externalComment!.sourceCardTemplateId, "source");
  assert.equal(layout.externalComment!.sourceDeckTemplateId, "original-deck");
  assert.match(renderToStaticMarkup(createElement(BackCardExternalComment, { comment: layout.externalComment })), /Original feedback/);
  assert.match(renderToStaticMarkup(createElement(BackCardMediaCarousel, { items: layout.backMediaItems })), /Earlier evidence/);
  const own = { ...media, id: "current-image", assetId: "current-key" };
  const edited = withCardMediaItems(layout, [own]);
  assert.deepEqual(edited.mediaItems, [own]); assert.deepEqual(visiblePersonalMedia(edited), [own, historicalMedia]);
  assert.deepEqual(withCardMediaItems(edited, []).backMediaItems, [historicalMedia]);
  // Source moderation/deletion is reflected by the next authoritative read.
  assert.deepEqual(buildCardLayout({ ...card, personalHistory: card.personalHistory!.slice(0, 1) }, { currentUserId: "alice", users: [] }).backMediaItems, []);
});

test("current segment does not replay stale history over optimistic current media", () => {
  const media = { id: "old", mediaType: "image" as const, src: "https://example.invalid/old", description: "Old" };
  assert.deepEqual(visiblePersonalMedia({ id: "same", mediaItems: [], personalHistory: [{ cardTemplateId: "same", currentAdoptedCardTemplateVersion: 1,
    eventVersionAttribution: "not-recorded", tests: [], chats: [], mediaItems: [media] }] }), []);
});

test("source-aware media identities and cache removal cannot delete a sibling/current item's matching ID", () => {
  const item = { id: "same", mediaType: "image" as const, src: "https://example.invalid/image", description: "Evidence" };
  assert.notEqual(personalMediaKey(item), personalMediaKey({ ...item, sourceCardTemplateId: "source" }));
  assert.notEqual(personalMediaKey({ ...item, sourceCardTemplateId: "a" }), personalMediaKey({ ...item, sourceCardTemplateId: "b" }));
  const card = buildCardLayout({ id: "source", label: "Card 1", targetDate: "", intro: { title: "Source", description: null, mediaItem: null },
    steps: [], signals: [], reflection: "", chats: [], mediaItems: [item] }, { currentUserId: "alice", users: [] });
  const store = new WorkingCardStore();
  store.accept("alice", [card]); store.accept("bob", [card]);
  store.removeMedia("alice", "source", "same");
  assert.deepEqual(store.project("alice", card).mediaItems, []);
  assert.deepEqual(store.project("bob", card).mediaItems, [item]);
});
