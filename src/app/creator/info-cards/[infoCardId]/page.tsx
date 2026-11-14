import Link from "next/link";
import EmbeddedAuthScreen from "@/components/auth/EmbeddedAuthScreen";
import InfoCardEditor from "@/components/info-cards/InfoCardEditor";
import { getCurrentUser } from "@/lib/auth";
import { InfoCardRepository } from "@/lib/infoCards/repository";
import { groupDraftAccess, infoEditor, personalRecoveryContext } from "@/lib/infoCards/queries";
import { isGroupInfo, isPersonalInfo } from "@/lib/infoCards/model";
import { redirect } from "next/navigation";
import { CardArchitectureError } from "@/lib/cards/domain";
import { creatorNavigation, type CreatorSearch } from "@/components/creator/creatorNavigation";

export default async function EditInfoCardPage({ params, searchParams }: { params: Promise<{ infoCardId: string }>; searchParams: Promise<CreatorSearch> }) {
  const user = await getCurrentUser(); if (!user) return <EmbeddedAuthScreen />;
  const { infoCardId } = await params;
  const initial = await infoEditor(await InfoCardRepository.application(), user.id, infoCardId).catch(error => {
    if (error instanceof CardArchitectureError && error.code === "INFO_FORBIDDEN") return null;
    throw error;
  });
  if (!initial) return <main className="app-shell"><p>Info Card unavailable.</p><Link href="/library?tab=info-cards">Back to Library</Link></main>;
  if (isPersonalInfo(initial.root)) {
    const context = await personalRecoveryContext(await InfoCardRepository.application(), user.id, initial.root);
    if (context) redirect(`/decks?${new URLSearchParams({ openDeck: context.deckTemplateId, openCard: context.cardTemplateId, personalDraft: infoCardId })}`);
  }
  // A Group Info Card opens here only as an unsaved draft from My Drafts, directly in the shared editor and
  // identified by its origin (C3). Once saved it is edited only in its creation context.
  if (isGroupInfo(initial.root)) {
    const access = await groupDraftAccess(await InfoCardRepository.application(), user.id, initial.root);
    if (!access.editable) return <main className="app-shell"><p>Info Card unavailable.</p><p data-info-draft-origin="">Created in: {access.origin}</p><Link href="/library?tab=info-cards">Back to Library</Link></main>;
    return <InfoCardEditor key={`${user.id}:${infoCardId}`} id={infoCardId} actor={user.id} username={user.username} initial={initial} navigation={creatorNavigation(await searchParams)} origin={access.origin} />;
  }
  return <InfoCardEditor key={`${user.id}:${infoCardId}`} id={infoCardId} actor={user.id} username={user.username} initial={initial} navigation={creatorNavigation(await searchParams)} />;
}
