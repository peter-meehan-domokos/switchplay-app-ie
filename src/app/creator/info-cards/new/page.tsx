import { randomUUID } from "node:crypto";
import EmbeddedAuthScreen from "@/components/auth/EmbeddedAuthScreen";
import InfoCardEditor from "@/components/info-cards/InfoCardEditor";
import { getCurrentUser } from "@/lib/auth";
import { InfoCardRepository } from "@/lib/infoCards/repository";
import { infoEditor } from "@/lib/infoCards/queries";
import { infoId } from "@/lib/infoCards/domain";
import { creatorNavigation, type CreatorSearch } from "@/components/creator/creatorNavigation";

export default async function NewInfoCardPage({ searchParams }: { searchParams: Promise<CreatorSearch> }) {
  const user = await getCurrentUser(); if (!user) return <EmbeddedAuthScreen />;
  const query = await searchParams; const draft = Array.isArray(query.draft) ? query.draft[0] : query.draft; const id = draft ?? randomUUID(); infoId(id);
  const initial = draft ? await infoEditor(await InfoCardRepository.application(), user.id, id).catch(() => null) : null;
  return <InfoCardEditor key={`${user.id}:${id}`} id={id} actor={user.id} username={user.username} initial={initial} navigation={creatorNavigation(query, true)} />;
}
