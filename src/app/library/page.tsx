import EmbeddedAuthScreen from "@/components/auth/EmbeddedAuthScreen";
import LibraryShell from "@/components/library/LibraryShell";
import { getCurrentUser } from "@/lib/auth";
import { CardRepository } from "@/lib/cards/repository";
import { libraryCollection } from "@/lib/cards/libraryReadModels";
import InfoCardsLibrary from "@/components/library/InfoCardsLibrary";
export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ tab?: string; published?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return <EmbeddedAuthScreen />;
  const query = await searchParams;
  if (query.tab === "info-cards") {
    return <InfoCardsLibrary key={user.id} actor={user.id} username={user.username} publishedId={query.published} />;
  }
  const repo = await CardRepository.application();
  const collection = await libraryCollection(repo, user.id);
  // An account change between publication and return must not carry the old
  // actor's highlight into the new session. Check only an already-public row.
  const publishedId = query.published && collection.entries.some(item => item.deckTemplateId === query.published)
    && await repo.decks().findOne({ deckTemplateId: query.published, ownerUserId: user.id }, { projection: { _id: 1 } }) ? query.published : undefined;
  return <LibraryShell key={user.id} initialCollection={collection} currentUserId={user.id} userName={user.username} publishedId={publishedId} />;
}
