import assert from "node:assert/strict";
import { test } from "node:test";
import { CardArchitectureError, assertCardContent, assertDeckContent, cardConfidence, createStep, initialCardData, initialTargetDate, reorderSteps, stepLinkedSignals, swapConstructionSteps } from "../src/lib/cards/domain";
import { personalCardImageKey, validateNewPersonalImage } from "../src/lib/cards/media";
import type { CardContent, CardTemplateRoot, DeckTemplateRoot } from "../src/lib/cards/model";

const content = (): CardContent => ({ intro: { title: "Card", description: null, mediaItem: null }, suggestedTargetDate: "", steps: [createStep("One"), createStep("Two"), createStep("Three")] });
test("generated Steps have unique global identity without a separate entity", () => {
  const steps = Array.from({ length: 1000 }, () => createStep());
  assert.equal(new Set(steps.map((step) => step.stepId)).size, steps.length);
});
test("Step-linked readings follow same-Card reorder; unset is excluded and 1 is a real reading", () => {
  const card = content(); const data = initialCardData("card", null, card, new Date());
  assert.equal(data.cardTemplateVersion, null);
  assert.equal(cardConfidence(card, data), null);
  data.signalReadings[0].reading = 1; assert.equal(cardConfidence(card, data), 1); data.signalReadings[1].reading = 9;
  assert.equal(cardConfidence(card, data), 5);
  const moved = reorderSteps(card, 0, 2);
  assert.equal(stepLinkedSignals(moved, data)[2].reading, 1);
  assert.equal(stepLinkedSignals(moved, data)[2].stepId, card.steps[0].stepId);
  assert.equal(data.items[0].completionStatus, "todo");
});
test("date initialization precedence is existing, suggested, generated without a scheduling side effect", () => {
  assert.equal(initialTargetDate("2026-10-01", "2026-10-02", "2026-10-03"), "2026-10-01");
  assert.equal(initialTargetDate(null, "2026-10-02", "2026-10-03"), "2026-10-02");
  assert.equal(initialTargetDate(null, "", "2026-10-03"), "2026-10-03");
  assert.equal(initialTargetDate(null, "", null), null);
});
test("drafts reject old labels, Signal definitions, positional readings and version notes", () => {
  for (const field of ["label", "signals", "signalReadings", "updateNote"]) assert.throws(() => assertCardContent({ ...content(), [field]: "legacy" }), CardArchitectureError);
  assert.throws(() => initialCardData("card", 0, content(), new Date()), { code: "INVALID_ADOPTED_VERSION" });
  assert.throws(() => assertDeckContent({ streams: [] }), CardArchitectureError);
});
test("publication history or published provenance prohibits cross-Card movement", () => {
  const a: CardTemplateRoot = { cardTemplateId: "a", ownerUserId: "alice", visibility: "private", latestVersion: 0, revision: 0,
    draft: content(), stepIds: [], forkedFrom: null, createdAt: new Date(), updatedAt: new Date() };
  const b = { ...a, cardTemplateId: "b", draft: content() };
  const deck: DeckTemplateRoot = { ...a, deckTemplateId: "deck", draft: null, forkedFrom: null };
  for (const kind of ["source", "destination", "deck", "fork"]) {
    const source = { ...a, latestVersion: kind === "source" ? 1 : 0, forkedFrom: kind === "fork" ? { cardTemplateId: "published", version: 3 } : null };
    assert.throws(() => swapConstructionSteps(source, { ...b, latestVersion: kind === "destination" ? 1 : 0 }, { ...deck, latestVersion: kind === "deck" ? 1 : 0 }, 0, 0), { code: "CROSS_CARD_MOVE_AFTER_PUBLICATION" });
  }
});
test("new personal images use user/Card namespace; browser cannot submit trusted legacy or foreign keys", () => {
  const uuid = "c4c33318-0f26-4cfa-8b76-691bbdd72f9a";
  const key = personalCardImageKey("alice", "card-global", "image/webp", uuid);
  assert.equal(key, `user-cards/alice/card-global/${uuid}.webp`);
  const url = (asset: string) => `https://assets.example.com/${asset}`;
  const media = { id: `image-${uuid}`, provider: "cloudflare-r2", mediaType: "image", assetId: key, src: url(key), description: "Image" };
  assert.deepEqual(validateNewPersonalImage(media, "alice", "card-global", url), media);
  assert.throws(() => validateNewPersonalImage({ ...media, assetId: `user-decks/alice/deck/cards/card/${uuid}.webp` }, "alice", "card-global", url));
  assert.throws(() => validateNewPersonalImage(media, "bob", "card-global", url));
  assert.throws(() => personalCardImageKey("../alice", "card", "image/png"));
});
