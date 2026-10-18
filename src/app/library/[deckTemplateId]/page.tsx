import EmbeddedAuthScreen from "@/components/auth/EmbeddedAuthScreen";
import LibraryShell from "@/components/library/LibraryShell";
import { getCurrentUser } from "@/lib/auth";
import { CardRepository } from "@/lib/cards/repository";
import { libraryDetail } from "@/lib/cards/libraryReadModels";
import { CardArchitectureError } from "@/lib/cards/domain";
import { notFound } from "next/navigation";
export default async function LibraryDeckPage({ params }: PageProps<'/library/[deckTemplateId]'>) {
  const user = await getCurrentUser();
  if (!user) return <EmbeddedAuthScreen />;
  let entry;
  try {
    entry = await libraryDetail(await CardRepository.application(), user.id, (await params).deckTemplateId);
  } catch (error) {
    if (error instanceof CardArchitectureError && error.code === "LIBRARY_DECK_FORBIDDEN") notFound();
    throw error;
  }
  return <LibraryShell key={`${user.id}:${entry.deckTemplateId}`} initialEntry={entry} currentUserId={user.id} userName={user.username} />;
}
