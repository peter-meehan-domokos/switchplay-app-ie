import Link from "next/link";
import EmbeddedAuthScreen from "@/components/auth/EmbeddedAuthScreen";
import InfoCardEditor from "@/components/info-cards/InfoCardEditor";
import { getCurrentUser } from "@/lib/auth";
import { InfoCardRepository } from "@/lib/infoCards/repository";
import { infoEditor } from "@/lib/infoCards/queries";
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
  return <InfoCardEditor key={`${user.id}:${infoCardId}`} id={infoCardId} actor={user.id} username={user.username} initial={initial} navigation={creatorNavigation(await searchParams)} />;
}
