import assert from "node:assert/strict";
import { test } from "node:test";
import { entryDeck, entryMembership } from "./fixtures/workingEntry";
import { canPresentWorkingMembership, WORKING_PRESENTATION_FRESH_MS } from "../src/lib/cards/workingEntry";
import { workingCardStore } from "../src/lib/cards/workingCardStore";
import { personalWork } from "../src/lib/cards/personalWork";
import { buildDeckLayout } from "../src/components/decks/deckLayout";

test("warm presentation requires fresh actor-bound, available, initialized membership and exact shared adoption", () => {
  const actor = "entry-eligibility", membership = entryMembership(entryDeck(0, actor));
  const fresh = { actor, at: 1000, epoch: workingCardStore.epoch(actor) };
  assert.equal(canPresentWorkingMembership(membership, actor, fresh, 1001), true);
  assert.equal(canPresentWorkingMembership(membership, "other", fresh, 1001), false);
  assert.equal(canPresentWorkingMembership(membership, actor, fresh, 999), false);
  assert.equal(canPresentWorkingMembership(membership, actor, fresh, 1000 + WORKING_PRESENTATION_FRESH_MS), false);
  assert.equal(canPresentWorkingMembership({ ...membership, archivedAt: new Date("2026-10-19") }, actor, fresh, 1001), false);
  for (const change of [ { openedAt: null }, { activeCardId: "missing" }, { cards: membership.display!.cards.map(card => ({ ...card, targetDate: "" })) } ]) {
    assert.equal(canPresentWorkingMembership(entryMembership({ ...membership.display!, ...change }), actor, fresh, 1001), false);
  }
  workingCardStore.accept(actor, buildDeckLayout({ ...membership.display!, cards: membership.display!.cards.map(card => ({ ...card, adoptedVersion: 2 })) }, { currentUserId: actor, users: [] }).cards);
  assert.equal(canPresentWorkingMembership(membership, actor, fresh, 1001), false);
  workingCardStore.clearUser(actor);
  workingCardStore.invalidate(actor);
  assert.equal(canPresentWorkingMembership(membership, actor, fresh, 1001), false);
});

test("pending or failed shared Card work and adoption locks exclude immediate presentation; empty initialized Decks are valid", async () => {
  const actor = "entry-work", membership = entryMembership(entryDeck(0, actor));
  const fresh = { actor, at: 1000, epoch: 0 }, scope = { userId: actor, cardIds: [membership.display!.cards[0].id] };
  let release!: () => void;
  const save = personalWork.run(scope, "entry-save", () => new Promise<void>(resolve => { release = resolve; }));
  assert.equal(canPresentWorkingMembership(membership, actor, fresh, 1001), false);
  await Promise.resolve(); release(); await save; await Promise.resolve();
  const unlock = personalWork.lock(scope);
  assert.equal(canPresentWorkingMembership(membership, actor, fresh, 1001), false); unlock();
  const failed = personalWork.run(scope, "entry-failure", async () => { throw Error("failed save"); });
  await assert.rejects(failed);
  assert.equal(canPresentWorkingMembership(membership, actor, fresh, 1001), false);
  personalWork.discardFailed(actor, "entry-failure", failed);
  assert.equal(canPresentWorkingMembership(membership, actor, fresh, 1001), true);
  assert.equal(canPresentWorkingMembership(entryMembership({ ...membership.display!, cards: [], activeCardId: "" }), actor, fresh, 1001), true);
});
