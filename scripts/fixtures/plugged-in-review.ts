import { contentImages, recordImageAllocation, INSTRUCTIONAL_IMAGE_ALLOCATIONS } from "../../src/lib/cards/instructionalImageOwnership";
import type { Db, MongoClient } from "mongodb";
import { CardRepository } from "../../src/lib/cards/repository";
import { createDefaultCardContent, createDefaultDeckContent } from "../../src/lib/cards/creatorDefaults";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import type { CardContent } from "../../src/lib/cards/model";
import type { StepMediaItem } from "../../src/lib/stepMedia";

export const VISUAL_REVIEW_CARDS = ["review-roots", "review-integration", "review-four-media", "review-legacy"] as const;
export function visualReviewContents(mediaOrigin: string): CardContent[] {
  const video = (id: "roots" | "area" | "legacy", slot: string, label = "Watch"): StepMediaItem & { kind: "video" } => ({ id: slot, kind: "video", label,
    media: { id: slot, mediaType: "video", provider: "cloudflare-stream", assetId: `fixture-review-${id}`, src: `https://iframe.videodelivery.net/fixture-review-${id}`, description: "Local playback sample", width: 192, height: 320 } });
  const image = (id: "roots" | "area", slot: string, label = "Sketch"): StepMediaItem => ({ id: slot, kind: "image", label,
    alt: id === "roots" ? "Static diagram of a quadratic and its roots" : "Static area-under-a-curve diagram",
    media: { id: slot, mediaType: "image", provider: "cloudflare-r2", assetId: `fixtures/${id}.png`, src: `${mediaOrigin}/assets/fixtures/${id}.png`, description: "Mathematical diagram" } });
  const visual = (id: "roots-and-factors" | "integration-area", slot: string, label = "Explore"): StepMediaItem => ({ id: slot, kind: "activity", label, activityId: id });
  const roots = visual("roots-and-factors", "roots"), area = visual("integration-area", "area");
  const base = (id: string) => createDefaultCardContent([`${id}-1`, `${id}-2`, `${id}-3`]);
  return [
    { ...base("roots"), intro: { title: "Roots and factors", description: "Connect the roots of a quadratic to its factors. Open Step 1 to explore.", mediaItems: [video("roots", "intro"), image("roots", "diagram")] },
      steps: [
        { stepId: "roots-1", title: "Explore", description: "Move a root and compare the graph with the factor (x − r).", mediaItems: [roots, image("roots", "diagram")] },
        { stepId: "roots-2", title: "Predict", description: "Predict the factor before revealing the answer. Your earlier visual work is shared here.", mediaItems: [video("roots", "clip"), { ...roots, id: "predict", label: "Try" }] },
        { stepId: "roots-3", title: "Retrieve", description: "Use the factor to place the missing root, then check your answer.", mediaItems: [image("roots", "diagram"), { ...roots, id: "retrieve", label: "Recall" }] },
      ] },
    { ...base("area"), intro: { title: "Integration: area under a curve", description: "Compare rectangles, area and the definite integral. Explore opens the seven-stage activity.", mediaItems: [video("area", "intro"), image("area", "diagram", "Area"), area] },
      steps: [
        { stepId: "area-1", title: "Approximate", description: "Move the interval boundaries and refine the rectangles to estimate area.", mediaItems: [video("area", "clip"), image("area", "diagram"), area] },
        { stepId: "area-2", title: "Explain", description: "Compare functions and connect the rectangle sum to the integral.", mediaItems: [area, image("area", "diagram", "Area")] },
        { stepId: "area-3", title: "Calculate", description: "Continue to the final stage, enter an answer and check it. Unchecked drafts also save.", mediaItems: [{ ...area, id: "check", label: "Check" }, video("area", "clip")] },
      ] },
    { ...base("four"), intro: { title: "Four ways to explore", description: "Four attachments, with the image first and the video third. Compare tab order and return behavior.", mediaItems: [image("area", "diagram", "Area"), area, video("area", "clip"), { ...roots, label: "Roots" }] },
      steps: [
        { stepId: "four-1", title: "Compare", description: "Switch between two real visuals, a clip and a static diagram. Each visual keeps its shared progress.", mediaItems: [roots, video("roots", "clip"), image("roots", "diagram"), { ...area, label: "Area" }] },
        { stepId: "four-2", title: "Revisit", description: "Return to the Integration activity and compare its saved stage with Card 2.", mediaItems: [area, image("area", "diagram", "Area")] },
        { stepId: "four-3", title: "Reflect", description: "Explain how a root, a factor and an area each connect a graph to an algebraic expression.", mediaItem: null },
      ] },
    { ...base("legacy"), intro: { title: "Single-video practice", description: "An unchanged legacy media shape: one video, no tabs and the original Introduction thumbnail.", mediaItem: video("legacy", "intro").media },
      steps: [
        { stepId: "legacy-1", title: "Watch", description: "Play the local sample, then use Next. Try pausing before moving on.", mediaItem: video("roots", "one").media },
        { stepId: "legacy-2", title: "Compare", description: "Check that the next video respects your paused or playing state.", mediaItem: video("area", "two").media },
        { stepId: "legacy-3", title: "Review", description: "Use Previous and Next. No one-item tab bar should appear.", mediaItem: video("legacy", "three").media },
      ] },
  ];
}
export async function seedVisualReview(db: Db, client: MongoClient, actor: string, mediaOrigin: string, disposableUri: string) {
  assertDisposableDatabase(disposableUri, db.databaseName);
  const repo = new CardRepository(db, client, "1"), contents = visualReviewContents(mediaOrigin);
  for (const [index, content] of contents.entries()) {
    // Explicit disposable seed evidence for the fixed local provider files only.
    // Never registers legacy/live media or writes an existing review database.
    const unique = new Map(contentImages(content).flatMap(image => "assetId" in image ? [[image.assetId, image] as const] : []));
    for (const image of unique.values()) {
      if (!("assetId" in image)) continue;
      await recordImageAllocation(db, actor, { scope: "card", targetId: VISUAL_REVIEW_CARDS[index] }, { assetId: image.assetId, deliveryUrl: image.src });
      await db.collection(INSTRUCTIONAL_IMAGE_ALLOCATIONS).updateOne({ assetId: image.assetId, "destination.targetId": VISUAL_REVIEW_CARDS[index] }, { $set: { ready: true } });
    }
    await repo.createCardDraft(actor, content, "public", VISUAL_REVIEW_CARDS[index]);
    await repo.publishCard(actor, VISUAL_REVIEW_CARDS[index], 0);
  }
  const deck = await repo.createDeckDraft(actor, { ...createDefaultDeckContent([]), title: "Plugged-in Step Visuals — iPhone review", cards: VISUAL_REVIEW_CARDS.map(cardTemplateId => ({ cardTemplateId })) }, "public");
  await repo.publishDeck(actor, deck.deckTemplateId, 0);
  await repo.ensureDeckData(actor, deck.deckTemplateId, 1);
  await repo.openWorkingDeck(actor, deck.deckTemplateId, new Date().toISOString().slice(0, 10));
  return `/decks?openDeck=${deck.deckTemplateId}&openCard=${VISUAL_REVIEW_CARDS[0]}`;
}
