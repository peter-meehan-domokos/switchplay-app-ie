import Link from "next/link";
import EmbeddedAuthScreen from "@/components/auth/EmbeddedAuthScreen";
import CreatorDragLab from "@/components/creator/CreatorDragLab";
import { creatorBoard } from "@/components/creator/cardArchitectureAdapter";
import { CardRepository } from "@/lib/cards/repository";
import { creatorDTO } from "@/lib/cards/readModels";
import { getCurrentUser } from "@/lib/auth";


type CreatorEditPageProps = {
  params: Promise<{
    deckTemplateId: string;
  }>;
  searchParams: Promise<{
    returnTo?: string | string[];
    returnDeckId?: string | string[];
  }>;
};

function readFirstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CreatorEditPage({ params, searchParams }: CreatorEditPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    return <EmbeddedAuthScreen />;
  }

  const { deckTemplateId } = await params;
  const resolvedSearchParams = await searchParams;
  const returnTo = readFirstSearchParam(resolvedSearchParams.returnTo);
  const returnDeckId = readFirstSearchParam(resolvedSearchParams.returnDeckId);
  const templateDocument = await creatorDTO(await CardRepository.application(), user.id, deckTemplateId).catch(() => null);

  if (!templateDocument) {
    return (
      <main className="creator-not-found">
        <p>Template not found.</p>
        <Link href="/decks">Back to decks</Link>
      </main>
    );
  }

  const canPreviewOutput = user.isAdmin === true || user.username === "dev";
  const creatorReturnTarget =
    returnTo === "deck" && typeof returnDeckId === "string" && returnDeckId.trim() !== ""
      ? { label: "Deck" as const, href: `/decks?openDeck=${encodeURIComponent(returnDeckId)}` }
      : { label: "Decks" as const, href: "/decks" };

  return (
    <CreatorDragLab
      canPreviewOutput={canPreviewOutput}
      creatorReturnTarget={creatorReturnTarget}
      initialBoard={creatorBoard(templateDocument)}
      initialCreator={templateDocument}
      mode="edit"
    />
  );
}
