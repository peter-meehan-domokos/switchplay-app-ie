import { captureMediaPreparation, acceptMediaPreparation, hasPreparedMedia } from "../mediaCollection/controller";
import { captureReflectionPreparation, acceptReflectionPreparation, hasPreparedReflection, type ReflectionAreaContext } from "../reflections/controller";
import { workingCardStore } from "./workingCardStore";
import type { PreparedContributions } from "./preparation";
import type { MediaCollectionContext } from "../mediaCollection/contracts";

export function captureCardPreparation(actor: string) {
  workingCardStore.trackUser(actor);
  return { actor, session: workingCardStore.session(actor), media: captureMediaPreparation(actor), reflections: captureReflectionPreparation(actor) };
}
export function acceptCardPreparation(capture: ReturnType<typeof captureCardPreparation>, contributions: PreparedContributions,
  ids: string[], mediaContext: (id: string) => MediaCollectionContext, reflectionContext: (id: string) => ReflectionAreaContext) {
  if (workingCardStore.session(capture.actor) !== capture.session) throw Error("The signed-in account changed. Reopen the Deck.");
  for (const id of ids) if (!contributions.media[id] || !contributions.reflections[id]) throw Error("Card preparation is incomplete. Retry opening the Deck.");
  for (const id of ids) {
    if (!acceptMediaPreparation(mediaContext(id), contributions.media[id], capture.media)
      || !acceptReflectionPreparation(reflectionContext(id), contributions.reflections[id], capture.reflections)) throw Error("Card content changed during opening. Retry to load its current state.");
  }
}

export function acceptPersonalPreparation(capture: ReturnType<typeof captureCardPreparation>, prepared: Awaited<ReturnType<typeof import("./preparation").preparePersonalDeck>>) {
  const { deck } = prepared;
  if (prepared.viewerUserId !== capture.actor || deck.dataOwnerUserId !== capture.actor) throw Error("The signed-in account changed. Reopen the Deck.");
  if (!deck.preparedAssessments || deck.cards.some(card => {
    const history = deck.preparedAssessments![card.id];
    return !history || history.viewerUserId !== capture.actor || history.cardTemplateId !== card.id;
  })) throw Error("Card assessment preparation is incomplete. Retry opening the Deck.");
  acceptCardPreparation(capture, prepared.contributions, deck.cards.map(card => card.id),
    cardTemplateId => ({ kind: "owner", viewerUserId: capture.actor, cardTemplateId }),
    cardTemplateId => ({ viewerUserId: capture.actor, cardTemplateId, deckTemplateId: deck.deckTemplateId, view: { kind: "personal" } }));
  return deck;
}

// Read-only readiness lookup; it neither creates a controller nor grants access.
export function hasInitialGroupPreparation(actor: string, bootstrap: import("../groupExperiences/presentationReads").GroupBootstrap, selection: import("../groupExperiences/model").PerspectiveSelection) {
  const experienceId = bootstrap.experienceId;
  return bootstrap.deck.cards.every(card => {
    const media: MediaCollectionContext = selection.perspective === "self" ? { kind: "owner", viewerUserId: actor, cardTemplateId: card.id, experienceId }
      : { kind: "group", viewerUserId: actor, cardTemplateId: card.id, experienceId, accessEpoch: bootstrap.accessEpoch, adoptionRevision: bootstrap.adoptionRevision, structureRevision: bootstrap.structureRevision, ...(selection.perspective === "follower" ? { subjectUserId: selection.subjectUserId } : {}) };
    const reflection: ReflectionAreaContext = { viewerUserId: actor, cardTemplateId: card.id, adoptionRevision: bootstrap.adoptionRevision, structureRevision: bootstrap.structureRevision,
      view: { kind: "group", experienceId, mode: selection.perspective === "self" ? "own" : selection.perspective === "group" ? "group" : "inspection", accessEpoch: bootstrap.accessEpoch, ...(selection.perspective === "follower" ? { subjectUserId: selection.subjectUserId } : {}) } };
    return hasPreparedMedia(media) && hasPreparedReflection(reflection);
  });
}
