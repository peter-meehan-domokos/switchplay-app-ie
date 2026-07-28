import Link from "next/link";
import AuthScreen from "@/components/auth/AuthScreen";
import CreatorDragLab from "@/components/creator/CreatorDragLab";
import { createCreatorBoardFromTemplate } from "@/components/creator/creatorBoardState";
import { getCurrentUser } from "@/lib/auth";
import { getVisibleDeckTemplateDocumentByIdForUser } from "@/lib/deckTemplateQueries";

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
    return <AuthScreen />;
  }

  const { deckTemplateId } = await params;
  const resolvedSearchParams = await searchParams;
  const returnTo = readFirstSearchParam(resolvedSearchParams.returnTo);
  const returnDeckId = readFirstSearchParam(resolvedSearchParams.returnDeckId);
  const templateDocument = await getVisibleDeckTemplateDocumentByIdForUser(user, deckTemplateId);

  if (!templateDocument) {
    return (
      <main className="creator-not-found">
        <p>Template not found.</p>
        <Link href="/decks">Back to decks</Link>
      </main>
    );
  }

  const canPreviewOutput = user.isAdmin === true || user.username === "dev";
  const editableTemplate = templateDocument.savedTemplate ?? templateDocument.template;
  const publishedBoard = createCreatorBoardFromTemplate(templateDocument.template);
  const creatorReturnTarget =
    returnTo === "deck" && typeof returnDeckId === "string" && returnDeckId.trim() !== ""
      ? { label: "Deck" as const, href: `/decks?openDeck=${encodeURIComponent(returnDeckId)}` }
      : { label: "Decks" as const, href: "/decks" };

  return (
    <CreatorDragLab
      canPreviewOutput={canPreviewOutput}
      creatorReturnTarget={creatorReturnTarget}
      initialBoard={createCreatorBoardFromTemplate(editableTemplate)}
      initialPublishedBoard={publishedBoard}
      mode="edit"
    />
  );
}
