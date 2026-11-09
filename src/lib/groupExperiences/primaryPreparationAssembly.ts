import type { PreparedGroup } from "./preparation";
import type { MediaCollectionPage } from "../mediaCollection/contracts";
import type { ReflectionFeed } from "../reflections/reads";
import { PreparationAssembly, type PreparationPage } from "./preparationPages";
export function assembledGroup(assembly: PreparationAssembly, authority: PreparationPage): PreparedGroup {
  const head = assembly.values.get(0) as Pick<PreparedGroup, "bootstrap" | "followers" | "aggregates"> | undefined;
  if (!head?.bootstrap || !Array.isArray(head.bootstrap.deck?.cards)) throw Error("Incomplete Group preparation. Retry.");
  const media: Record<string, MediaCollectionPage> = {}, reflections: Record<string, ReflectionFeed> = {};
  for (let i = 0; i < head.bootstrap.deck.cards.length; i++) {
    const row = assembly.values.get(i + 1) as { cardTemplateId: string; media: MediaCollectionPage; reflection: ReflectionFeed } | undefined;
    if (!row || row.cardTemplateId !== head.bootstrap.deck.cards[i].id || !row.media || !row.reflection) throw Error("Incomplete Group Card preparation. Retry.");
    media[row.cardTemplateId] = row.media; reflections[row.cardTemplateId] = row.reflection;
  }
  return { viewerUserId: authority.viewerUserId, experienceId: authority.experienceId, accessEpoch: authority.accessEpoch,
    structureRevision: authority.structureRevision, adoptionRevision: authority.adoptionRevision, ...head, contributions: { media, reflections } };
}
