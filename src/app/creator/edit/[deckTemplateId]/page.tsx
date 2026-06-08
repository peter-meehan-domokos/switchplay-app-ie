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
};

export default async function CreatorEditPage({ params }: CreatorEditPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    return <AuthScreen />;
  }

  const { deckTemplateId } = await params;
  const templateDocument = await getVisibleDeckTemplateDocumentByIdForUser(user, deckTemplateId);

  if (!templateDocument) {
    return (
      <main className="creator-not-found">
        <p>Template not found.</p>
        <Link href="/">Back to decks</Link>
      </main>
    );
  }

  return (
    <CreatorDragLab
      canUpdateExistingTemplate={templateDocument.ownerUserId === user.id}
      initialBoard={createCreatorBoardFromTemplate(templateDocument.template)}
      mode="edit"
    />
  );
}
