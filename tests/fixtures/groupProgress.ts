import { createDefaultCardContent } from "../../src/lib/cards/creatorDefaults";
import type { LearningFields } from "../../src/lib/cards/learning";
import type { CompletionStatus } from "../../src/components/decks/types";
import { assertFrameworkConfiguration, type Framework } from "../../src/lib/frameworks/configurationContracts";
import { calculateMappedProgress, type CardCalculation } from "../../src/lib/frameworks/calculations";
import { resolveEffectiveMapping } from "../../src/lib/frameworks/mapping";
import { metrics, followerMetrics } from "../../src/lib/groupExperiences/readModels";
import { compactAssessmentHistory, orderHistoryResults, type AssessmentHistory, type HistoryResult } from "../../src/lib/assessments/history";
import type { AssessmentResult } from "../../src/lib/assessments/contracts";
import type { ProgressSummary, ProgressMetadata } from "../../src/lib/frameworks/progressClient";

// Test data only: this module is never imported by the application or curriculum.
const titles = ["Find a steady base", "Control the movement", "Change direction", "Finish on balance",
  "Follow the passing line", "Receive and turn", "Choose a clear lane", "Time the release",
  "Track your partner", "Recover your position", "Build a short sequence", "Review the final action"];
const statuses: CompletionStatus[][] = [
  ["done", "done", "done"], ["done", "inProgress", "todo"], ["skipped", "done", "done"], ["todo", "todo", "todo"],
  ["inProgress", "inProgress", "inProgress"], ["done", "todo", "todo"], ["done", "skipped", "inProgress"], ["done", "done", "done"],
  ["skipped", "skipped", "skipped"], ["todo", "inProgress", "done"], ["done", "done", "todo"], ["inProgress", "todo", "skipped"],
];
const readings: (number | null)[][] = [[9, 8, 10], [4, 6, 5], [7, null, 8], [1, 2, 3],
  [2, 3, 1], [1, 2, 3], [4, 5, null], [6, 7, 5], [9, 8, 10], [6, 7, 8], [7, 8, 9], [null, 9, 10]];

export function groupProgressFixture(ids = titles.map((_, i) => `progress-review-card-${i + 1}`)) {
  if (ids.length !== titles.length || new Set(ids).size !== titles.length) throw Error("Expected twelve distinct fixture Cards");
  const learning = (card: number, states: CompletionStatus[], values: (number | null)[]): LearningFields => ({
    items: states.map((completionStatus, step) => ({ stepId: `progress-${card + 1}-${step + 1}`, completionStatus })),
    signalReadings: values.map((reading, step) => ({ stepId: `progress-${card + 1}-${step + 1}`, reading })),
  });
  const cards = ids.map((cardTemplateId, i) => ({ cardTemplateId, version: 1,
    content: { ...createDefaultCardContent([1, 2, 3].map(step => `progress-${i + 1}-${step}`)),
      intro: { title: titles[i], description: `Review Card ${i + 1}: ${titles[i].toLowerCase()}.`, mediaItem: null },
      steps: ["Set up", "Try", "Check"].map((verb, step) => ({ stepId: `progress-${i + 1}-${step + 1}`,
        title: `${verb} action ${i + 1}.${step + 1}`, description: `Placeholder instruction for Card ${i + 1}, Step ${step + 1}.`, mediaItem: null })) },
    learning: learning(i, statuses[i], readings[i]) }));
  const followerLearning = [0, 1, 2, 3].map(follower => cards.map((_, i) => learning(i,
    [0, 1, 2].map(step => (["done", "inProgress", "todo", "skipped", "todo", "done"] as const)[(i + step + follower * 2) % 6]),
    [0, 1, 2].map(step => (i + step + follower) % 7 ? 1 + (i * 3 + step + follower * 2) % 10 : null))));
  const framework: Framework = { id: "galway-progress-review", title: "U18 Movement & Skills", areas:
    ["Movement", "Passing", "Team sequences"].map((title, area) => ({ id: `review-area-${area + 1}`, title,
      items: ["Foundation", "Control", "Application"].map((name, item) => ({ id: `review-item-${area + 1}-${item + 1}`,
        title: `${title}: ${name.toLowerCase()}`, cardTemplateIds: item === 0 ? ids.slice(area * 4, area * 4 + 2) : [ids[area * 4 + item + 1]] })) })) };
  assertFrameworkConfiguration([framework]);
  const result = (id: string, day: number, passed: boolean): AssessmentResult => ({ id, date: `2026-10-${String(day).padStart(2, "0")}`,
    result: passed, createdAt: `2026-10-${String(day).padStart(2, "0")}T12:00:00.000Z` });
  // Deliberately held outside Mongo: these are NOT personal CardData.tests.
  const cardTests = Object.fromEntries(ids.map((id, i) => [id, [result(`review-card-${i + 1}-a`, i + 3, i % 2 === 0),
    result(`review-card-${i + 1}-b`, i + 17, i % 3 !== 0)]]));
  const itemTests = Object.fromEntries(framework.areas.flatMap(area => area.items.map((item, i) => [item.id,
    [result(`${item.id}-a`, 28, i % 2 === 0), result(`${item.id}-b`, 29, i % 2 !== 0), result(`${item.id}-c`, 30, i % 2 === 0)]])));
  return { name: "Galway U18", cards, framework, followerLearning, cardTests, itemTests };
}

export function projectGroupProgressFixture(fixture: ReturnType<typeof groupProgressFixture>,
  group: LearningFields[] = fixture.cards.map(card => card.learning), followers = fixture.followerLearning) {
  const { cards, framework } = fixture;
  if (group.length !== cards.length || followers.some(rows => rows.length !== cards.length)) throw Error("Incomplete fixture learning");
  const graph = new Map(cards.map(card => [card.cardTemplateId, { cardTemplateId: card.cardTemplateId, forkedFrom: null }]));
  const eligibility = { cardTemplateIds: cards.map(card => card.cardTemplateId), unknownComposition: false, issues: [] };
  const calculations = new Map<string, CardCalculation>(cards.map((card, i) => [card.cardTemplateId, { state: "complete",
    cardTemplateId: card.cardTemplateId, adoptedVersion: card.version, steps: group[i].items, readings: group[i].signalReadings.map(signal => signal.reading) }]));
  const selected = (scope: { areaId: string } | { itemId: string }) => cards.flatMap((card, i) => {
    const mapping = resolveEffectiveMapping(framework, card.cardTemplateId, graph);
    return mapping.state === "mapped" && ("areaId" in scope ? mapping.areaId === scope.areaId : mapping.itemId === scope.itemId) ? [i] : [];
  });
  const progress = (scope: { areaId: string } | { itemId: string }) => {
    const mapped = calculateMappedProgress(framework, scope, graph, eligibility, calculations);
    // Preserve Group's neutral-skipped convention, including null when every
    // selected Step is skipped. Do not change the personal percentage helper.
    return { ...mapped, ...metrics(selected(scope).map(i => group[i])) };
  };
  const histories: Record<string, AssessmentHistory> = {};
  const summary: ProgressSummary = { id: framework.id, title: framework.title, areas: framework.areas.map(area => ({
    id: area.id, title: area.title, hasConfiguredCards: true, progress: progress({ areaId: area.id }), items: area.items.map(item => {
      const results: HistoryResult[] = [];
      const add = (test: AssessmentResult, cardId?: string) => results.push({ ...test,
        source: cardId ? { kind: "card", cardTemplateId: cardId } : { kind: "item", itemId: item.id }, sourceRevision: 0, canMutate: false,
        relationship: cardId ? "own-card" : "direct-item", sourceTitle: cardId ? cards.find(card => card.cardTemplateId === cardId)!.content.intro.title : "Item test",
        titleAvailability: cardId ? "available" : "not-applicable", exposedThroughCardTemplateIds: cardId ? [cardId] : [] });
      selected({ itemId: item.id }).forEach(i => fixture.cardTests[cards[i].cardTemplateId].forEach(test => add(test, cards[i].cardTemplateId)));
      fixture.itemTests[item.id].forEach(test => add(test));
      const ordered = orderHistoryResults(results);
      const history: AssessmentHistory = { state: "complete", count: ordered.length, readableCount: ordered.length, results: ordered,
        latestThree: ordered.slice(0, 3).reverse(), sources: [...new Map(ordered.map(row => [JSON.stringify(row.source),
          { source: row.source, revision: 0, canMutate: false }])).values()], issues: [] };
      histories[item.id] = history;
      return { id: item.id, title: item.title, hasConfiguredCards: true, progress: progress({ itemId: item.id }), assessments: compactAssessmentHistory(history) };
    }) })) };
  const metadata: ProgressMetadata = [{ id: framework.id, title: framework.title,
    areas: framework.areas.map(area => ({ id: area.id, title: area.title, items: area.items.map(item => ({ id: item.id, title: item.title })) })) }];
  const followerComparisons = Object.fromEntries(framework.areas.map(area => [area.id,
    followerMetrics(followers.map(rows => selected({ areaId: area.id }).map(i => rows[i])))]));
  return { summary, metadata, histories, followerComparisons };
}

export type GroupProgressPreview = ReturnType<typeof projectGroupProgressFixture> & { actor: string; name: string; experienceId: string };
