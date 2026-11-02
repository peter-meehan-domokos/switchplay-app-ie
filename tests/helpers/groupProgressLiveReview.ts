import { ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";
import type { CardRepository } from "../../src/lib/cards/repository";
import { createDefaultCardContent, createDefaultDeckContent } from "../../src/lib/cards/creatorDefaults";
import { initialCardData } from "../../src/lib/cards/domain";
import { manualAssessmentProvenance } from "../../src/lib/assessments/provenance";
import { GroupExperienceRepository } from "../../src/lib/groupExperiences/repository";
import { seedGroupProgressReview } from "./groupProgressReview";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";

// A distinct real-API dataset. The original 5.0 preview, helper and static
// assessment adapter remain unchanged and are not used as production storage.
export async function seedLiveGroupProgress(cards: CardRepository, uri: string, actor: string, other: string, existingCards: string[]) {
  assertDisposableDatabase(uri, cards.db.databaseName);
  const seeded = await seedGroupProgressReview(cards, uri, actor, other), groups = new GroupExperienceRepository(cards), now = new Date();
  const { cards: fixtureCards } = seeded.fixture, experienceId = seeded.data.experienceId;
  // Rename only this account's display identity; its ID, email login, roles and
  // all associated learning/results are unchanged. Other harness modes retain
  // their established `other` username and fixtures.
  await cards.users().updateOne({ _id: new ObjectId(other) }, { $set: { username: "Aoife Kelly" } });
  const framework = { ...seeded.fixture.framework, areas: seeded.fixture.framework.areas.map(area => ({ ...area, items: area.items.map(item => ({ ...item, cardTemplateIds: [...item.cardTemplateIds] })) })) };
  await groups.saveSettings(actor, experienceId, { operationId: "live-progress-peers", expectedStructureRevision: 0, allowFollowerInspection: true });
  const origin = await groups.create(actor, { name: "Galway U14 Regional Basketball Development Squad", operationId: randomUUID(), adminIds: [], followerIds: [],
    manifest: { deckTemplateId: seeded.deckId, deckVersion: 1, cards: fixtureCards.map(card => ({ cardTemplateId: card.cardTemplateId, version: 1 })) } });
  for (const [index, card] of fixtureCards.entries()) {
    // Explicit legacy imports are confined to the opening Card; recent club
    // results always retain their actual Galway recording context.
    const count = [2, 2, 1, 0, 3, 1, 0, 2, 1, 0, 0, 1][index];
    const tests = Array.from({ length: count }, (_, i) => ({ id: `club-card-${index}-${i}`, result: (index + i) % 3 !== 0,
      date: index === 0 && i === 0 ? "2026-09-08" : `2026-10-${String(7 + index + i * 6).padStart(2, "0")}`,
      createdAt: new Date(index === 0 && i === 0 ? "2026-09-08T18:00:00Z" : `2026-10-${String(7 + index + i * 6).padStart(2, "0")}T18:00:00Z`),
      ...(index === 0 && i === 0 ? {} : { provenance: manualAssessmentProvenance(actor, { groupExperienceId: experienceId, deckTemplateId: seeded.deckId }) }) }));
    await groups.states().updateOne({ experienceId, cardTemplateId: card.cardTemplateId }, { $set: { tests, testsRevision: 1,
      ...(index === 9 ? { items: card.learning.items.map(step => ({ ...step, completionStatus: "skipped" })) } : {}) } });
  }
  const itemTests = framework.areas.flatMap(area => area.items).flatMap((item, index) =>
    Array.from({ length: [3, 1, 0, 2, 1, 0, 1, 0, 0][index] }, (_, i) => ({ id: `club-item-${index}-${i}`, result: i > 0 || index % 2 === 0,
      date: `2026-10-${String(10 + index + i * 8).padStart(2, "0")}`, createdAt: new Date(`2026-10-${String(10 + index + i * 8).padStart(2, "0")}T19:00:00Z`),
      frameworkItemId: item.id, provenance: manualAssessmentProvenance(actor, { groupExperienceId: experienceId, deckTemplateId: null }) })));
  await groups.experiences().updateOne({ experienceId }, { $set: { itemTests, itemTestsRevision: 1, itemAssessmentSourceIds: framework.areas.flatMap(area => area.items.map(item => item.id)) } });
  for (const [person, id] of seeded.followers.entries()) {
    for (const [index, card] of fixtureCards.entries()) {
      await cards.users().updateOne({ _id: new ObjectId(id) }, { $set: {
        "cardsData.$[card].tests": Array.from({ length: index === 0 ? 4 : index === 1 ? 2 : index < 9 - person * 2 && index % 3 !== 2 ? 1 + Number(person === 0 && index % 2 === 0) : 0 }, (_, i) => ({
          id: `player-${person}-${index}-${i}`, date: index === 0 && i >= 2 ? `2026-09-${i === 2 ? "12" : "23"}` : `2026-10-${String(9 + index + i * 8 + person).padStart(2, "0")}`,
          result: (index + person + i) % 3 !== 0,
          createdAt: new Date(index === 0 && i >= 2 ? `2026-09-${i === 2 ? "12" : "23"}T18:00:00Z` : `2026-10-${String(9 + index + i * 8 + person).padStart(2, "0")}T18:00:00Z`),
          ...(index === 0 && i === 2 ? {} : { provenance: manualAssessmentProvenance(id, {
            groupExperienceId: index === 0 && i === 3 ? origin.experienceId : i === 1 ? null : experienceId,
            deckTemplateId: seeded.deckId }) }) })),
        "cardsData.$[card].testsRevision": 1,
        ...(index === 10 || person === 0 && (index === 8 || index === 9) ? { "cardsData.$[card].items": card.learning.items.map(step => ({ ...step, completionStatus: "skipped" })) } : {}),
      } }, { arrayFilters: [{ "card.cardTemplateId": card.cardTemplateId }] });
    }
    const personalItems = framework.areas.flatMap(area => area.items).flatMap((item, index) =>
      Array.from({ length: index === 0 ? 2 : index === 1 && person < 2 ? 1 : index === 3 && person === 0 ? 2 : 0 }, (_, i) => ({
        id: `player-item-${person}-${index}-${i}`, itemId: item.id, result: i > 0 || person % 2 === 0,
        date: `2026-10-${String(15 + index + person + i * 9).padStart(2, "0")}`,
        createdAt: new Date(`2026-10-${String(15 + index + person + i * 9).padStart(2, "0")}T19:00:00Z`),
        provenance: manualAssessmentProvenance(id, { groupExperienceId: i === 0 ? experienceId : null, deckTemplateId: null }) })));
    await cards.users().updateOne({ _id: new ObjectId(id) }, { $set: { itemTests: personalItems, itemTestsRevision: 1 } });
  }
  const outside: string[] = [];
  for (const title of ["Personal skipped example", "Future practice outside the Group"]) {
    const card = await cards.createCardDraft(actor, { ...createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]), intro: { title, description: "Disposable Progress review content.", mediaItem: null } }, "public");
    await cards.publishCard(actor, card.cardTemplateId, 0); outside.push(card.cardTemplateId);
  }
  const libraryDeck = await cards.createDeckDraft(actor, { ...createDefaultDeckContent([]), title: "Additional practice", cards: outside.map(cardTemplateId => ({ cardTemplateId })) }, "public");
  await cards.publishDeck(actor, libraryDeck.deckTemplateId, 0);
  const personalDeck = await cards.createDeckDraft(actor, { ...createDefaultDeckContent([]), title: "Skipped personal practice", cards: [{ cardTemplateId: outside[0] }] }, "public");
  await cards.publishDeck(actor, personalDeck.deckTemplateId, 0); await cards.ensureDeckData(actor, personalDeck.deckTemplateId, 1);
  const version = (await cards.getCardVersion(outside[0], 1))!;
  const data = initialCardData(outside[0], 1, version.content, now); data.items.forEach(step => { step.completionStatus = "skipped"; }); data.signalReadings[0].reading = 6;
  await cards.users().updateOne({ _id: new ObjectId(actor) }, { $set: { "cardsData.$[card].items": data.items, "cardsData.$[card].signalReadings": data.signalReadings } }, { arrayFilters: [{ "card.cardTemplateId": outside[0] }] });
  framework.areas[0].items[0].cardTemplateIds.push(outside[0], ...existingCards.slice(0, 1));
  framework.areas[0].items[1].cardTemplateIds.push(...existingCards.slice(1, 2)); framework.areas[0].items[2].cardTemplateIds.push(...existingCards.slice(2, 3));
  framework.areas.push({ id: "review-outside-area", title: "Additional practice", items: [
    { id: "review-outside-item", title: "Future practice", cardTemplateIds: [outside[1]] }, { id: "review-empty-item", title: "Unassigned practice", cardTemplateIds: [] }] });
  return { frameworks: [framework], experienceId, frameworkId: framework.id, personalDeckId: personalDeck.deckTemplateId,
    skippedCardId: outside[0], cardIds: fixtureCards.map(card => card.cardTemplateId), followers: seeded.followers, followerLogin: "phase2-1@example.invalid" };
}
