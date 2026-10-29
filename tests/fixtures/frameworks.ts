import type { Framework } from "../../src/lib/frameworks/configuration";
import type { CardData, CardTemplateRoot, CardTemplateVersion, DeckData, DeckTemplateRoot, DeckTemplateVersion } from "../../src/lib/cards/model";
import { createDefaultCardContent, createDefaultDeckContent } from "../../src/lib/cards/creatorDefaults";
import { initialCardData } from "../../src/lib/cards/domain";

export function frameworkFixtures() {
  return [
    { id: "practice", title: "Practice", areas: [
      { id: "skills", title: "Skills", items: [
        { id: "practice-control", title: "Control", cardTemplateIds: ["original", "second"] },
        { id: "practice-speed", title: "Speed", cardTemplateIds: ["speed"] },
        { id: "practice-empty", title: "Unmapped goal", cardTemplateIds: [] },
      ] },
      { id: "empty", title: "Empty Area", items: [] },
    ] },
    { id: "alternative", title: "Alternative", areas: [
      { id: "skills", title: "Different structure", items: [
        { id: "alternative-speed", title: "Alternative goal", cardTemplateIds: ["original"] },
      ] },
    ] },
    { id: "empty-framework", title: "Empty Framework", areas: [] },
  ] satisfies Framework[];
}

export function cardFixture(id: string, parent: string | null = null) {
  const now = new Date("2026-10-11T10:00:00Z"), content = createDefaultCardContent([`${id}-1`, `${id}-2`, `${id}-3`]);
  const root: CardTemplateRoot = { cardTemplateId: id, ownerUserId: "alice", visibility: "private", latestVersion: 1,
    draft: content, revision: 1, forkedFrom: parent ? { cardTemplateId: parent, version: 1 } : null,
    stepIds: content.steps.map((step) => step.stepId), createdAt: now, updatedAt: now };
  const version: CardTemplateVersion = { cardTemplateId: id, version: 1, content, visibility: "private", publishedAt: now, publishedByUserId: "alice" };
  const data: CardData = initialCardData(id, 1, content, now);
  return { root, version, data };
}

export function deckFixture(id: string, cards: string[], archived = false) {
  const now = new Date("2026-10-11T10:00:00Z"), content = { ...createDefaultDeckContent([]), title: id, cards: cards.map((cardTemplateId) => ({ cardTemplateId })) };
  const root: DeckTemplateRoot = { deckTemplateId: id, ownerUserId: "alice", visibility: "private", latestVersion: 1,
    draft: content, revision: 1, forkedFrom: null, createdAt: now, updatedAt: now };
  const version: DeckTemplateVersion = { deckTemplateId: id, version: 1, content: { ...content, cards: cards.map((cardTemplateId) => ({ cardTemplateId, cardVersionAtPublish: 1 })) },
    visibility: "private", publishedAt: now, publishedByUserId: "alice" };
  const data: DeckData = { deckTemplateId: id, deckTemplateVersion: 1, archivedAt: archived ? now : null, activeCardId: null,
    sharedWithUserIds: [], createdAt: now, updatedAt: now, openedAt: null, cadenceAnchorDate: null };
  return { root, version, data };
}
