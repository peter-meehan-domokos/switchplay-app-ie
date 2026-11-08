import assert from "node:assert/strict";
import { test } from "node:test";
import { captureCardPreparation, acceptCardPreparation, acceptPersonalPreparation } from "../src/lib/cards/preparationClient";
import { workingCardStore } from "../src/lib/cards/workingCardStore";
import type { preparePersonalDeck } from "../src/lib/cards/preparation";

test("pending first preparation is invalidated by logout even before a Card controller exists", () => {
 const capture = captureCardPreparation("first-preparation-owner"); workingCardStore.clearSession();
 assert.throws(() => acceptCardPreparation(capture, { media: {}, reflections: {} }, [], () => { throw Error("unused"); }, () => { throw Error("unused"); }), /account changed/);
});
test("missing contribution sections are unknown, never accepted as empty", () => {
 const capture = captureCardPreparation("missing-preparation-owner");
 assert.throws(() => acceptCardPreparation(capture, { media: {}, reflections: {} }, ["missing"], () => { throw Error("unexpected"); }, () => { throw Error("unexpected"); }), /incomplete/);
 workingCardStore.clearUser(capture.actor);
});
test("Personal readiness rejects wrong owners and missing assessment metadata", () => {
 const capture = captureCardPreparation("prepared-personal-owner");
 const value = { viewerUserId: capture.actor, deck: { dataOwnerUserId: capture.actor, cards: [{ id: "c" }] }, contributions: { media: {}, reflections: {} } } as Awaited<ReturnType<typeof preparePersonalDeck>>;
 assert.throws(() => acceptPersonalPreparation(capture, value), /assessment preparation is incomplete/);
 assert.throws(() => acceptPersonalPreparation(capture, { ...value, viewerUserId: "other-owner" }), /account changed/);
 workingCardStore.clearUser(capture.actor);
});

test("initial Group readiness is exact-perspective and composition scoped without creating empty data", async () => {
 const { hasInitialGroupPreparation } = await import("../src/lib/cards/preparationClient");
 const b = { experienceId: "prepared-group", accessEpoch: 0, adoptionRevision: 0, structureRevision: 0, deck: { cards: [{ id: "c" }] } } as import("../src/lib/groupExperiences/presentationReads").GroupBootstrap;
 const actor = "group-readiness-owner", capture = captureCardPreparation(actor);
 assert.equal(hasInitialGroupPreparation(actor, b, { perspective: "group" }), false);
 const media = { viewerUserId: actor, cardTemplateId: "c", experienceId: b.experienceId, accessEpoch: 0, adoptionRevision: 0, structureRevision: 0, subjectUserId: null, total: 0, olderCount: 0, items: [], older: null, newer: null };
 const reflection = { viewerUserId: actor, cardTemplateId: "c", view: { kind: "group" as const, experienceId: b.experienceId, mode: "group" as const, accessEpoch: 0 }, accessEpoch: 0, adoptionRevision: 0, items: [] };
 acceptCardPreparation(capture, { media: { c: media }, reflections: { c: reflection } }, ["c"],
   cardTemplateId => ({ kind: "group", viewerUserId: actor, cardTemplateId, experienceId: b.experienceId, accessEpoch: 0, adoptionRevision: 0, structureRevision: 0 }),
   cardTemplateId => ({ viewerUserId: actor, cardTemplateId, view: reflection.view, adoptionRevision: 0, structureRevision: 0 }));
 assert.equal(hasInitialGroupPreparation(actor, b, { perspective: "group" }), true);
 assert.equal(hasInitialGroupPreparation(actor, b, { perspective: "follower", subjectUserId: "someone" }), false);
 assert.equal(hasInitialGroupPreparation(actor, { ...b, adoptionRevision: 1 }, { perspective: "group" }), false);
 workingCardStore.clearGroup(actor, b.experienceId); assert.equal(hasInitialGroupPreparation(actor, b, { perspective: "group" }), false); workingCardStore.clearUser(actor);
});
