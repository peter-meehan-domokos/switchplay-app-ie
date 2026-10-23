import EmbeddedAuthScreen from "@/components/auth/EmbeddedAuthScreen";
import LibraryShell from "@/components/library/LibraryShell";
import { getCurrentUser } from "@/lib/auth";
import { CardRepository } from "@/lib/cards/repository";
import { libraryCollection } from "@/lib/cards/libraryReadModels";
import InfoCardsLibrary from "@/components/library/InfoCardsLibrary";
export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return <EmbeddedAuthScreen />;
  if ((await searchParams).tab === "info-cards") return <InfoCardsLibrary key={user.id} actor={user.id} username={user.username} />;
  const collection = await libraryCollection(await CardRepository.application(), user.id);
  return <LibraryShell key={user.id} initialCollection={collection} currentUserId={user.id} userName={user.username} />;
}
