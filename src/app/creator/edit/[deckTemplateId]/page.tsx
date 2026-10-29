import Link from "next/link";
import EmbeddedAuthScreen from "@/components/auth/EmbeddedAuthScreen";
import CreatorDragLab from "@/components/creator/CreatorDragLab";
import { creatorBoard, sessionBoardDTO } from "@/components/creator/cardArchitectureAdapter";
import { CardRepository } from "@/lib/cards/repository";
import { creatorSessionDTO } from "@/lib/cards/creatorSession";
import { getCurrentUser } from "@/lib/auth";
import { creatorNavigation, deckReturnOrigin } from "@/components/creator/creatorNavigation";


type CreatorEditPageProps = {
  params: Promise<{
    deckTemplateId: string;
  }>;
  searchParams: Promise<{
    returnTo?: string | string[];
    returnDeckId?: string | string[];
    version?: string;
    cards?: string;
    progressFramework?: string;
    progressArea?: string;
    entry?: string;
    draftOrigin?: string;
    drafts?: string;
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
  const navigation = creatorNavigation(resolvedSearchParams);
  const returnTo = readFirstSearchParam(resolvedSearchParams.returnTo);
  const returnDeckId = readFirstSearchParam(resolvedSearchParams.returnDeckId);
  const templateDocument = await Promise.resolve().then(async () => creatorSessionDTO(await CardRepository.application(), user.id, deckTemplateId,
    returnTo === "deck" ? { kind: "my-decks", deckTemplateId: returnDeckId ?? deckTemplateId } : { kind: "library" },
    resolvedSearchParams.version ? Number(resolvedSearchParams.version) : undefined,
    resolvedSearchParams.cards ? JSON.parse(resolvedSearchParams.cards) : undefined)).catch(() => null);

  if (!templateDocument) {
    return (
      <main className="creator-not-found">
        <p>Template not found.</p>
        <Link href="/decks">Back to My Decks</Link>
      </main>
    );
  }

  const canPreviewOutput = user.isAdmin === true || user.username === "dev";
  const returnOrigin = deckReturnOrigin(resolvedSearchParams, deckTemplateId);
  const creatorReturnTarget =
    returnOrigin === "library"
      ? { label: "Library" as const, href: "/library" }
      : returnOrigin === "my-decks"
      ? { label: "My Decks" as const, href: "/decks" }
      : undefined;

  return (
    <CreatorDragLab
      key={`${user.id}:${deckTemplateId}`}
      canPreviewOutput={canPreviewOutput}
      creatorReturnTarget={creatorReturnTarget}
      navigation={navigation}
      initialBoard={creatorBoard(sessionBoardDTO(templateDocument))}
      initialSession={templateDocument}
      currentUserId={user.id}
      mode="edit"
    />
  );
}
