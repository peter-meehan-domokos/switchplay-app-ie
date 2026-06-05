import Link from "next/link";
import AuthScreen from "@/components/auth/AuthScreen";
import CreatorDragLab from "@/components/creator/CreatorDragLab";
import { createCreatorBoardFromTemplate } from "@/components/creator/creatorBoardState";
import { getCurrentUser } from "@/lib/auth";
import { deckTemplates } from "@/mocks/deckTemplates";
import { getVisibleDeckTemplatesForUser } from "@/mocks/templateAccess";

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
  const visibleTemplates = getVisibleDeckTemplatesForUser(user.username, deckTemplates);
  const template = visibleTemplates.find((candidate) => candidate.deckTemplateId === deckTemplateId);

  if (!template) {
    return (
      <main className="creator-not-found">
        <p>Template not found.</p>
        <Link href="/">Back to decks</Link>
      </main>
    );
  }

  return <CreatorDragLab initialBoard={createCreatorBoardFromTemplate(template)} mode="edit" />;
}
