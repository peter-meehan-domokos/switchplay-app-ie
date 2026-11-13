import type { PublicationRequestState } from "@/lib/infoCards/model";

// What every interface that resumes pending Publish and Save requests shows for them (checkpoint 10): the
// editor, My Drafts, the Info Card list and the Info Card consultation. One wording for all of them.
export type InfoCardPublicationNotice = { infoCardId: string; tone: "status" | "alert"; message: string };

const named = (state: Pick<PublicationRequestState, "title">, start = true) => state.title.trim() ? `“${state.title.trim()}”` : start ? "This Info Card" : "this Info Card";

export function publicationNotice(state: PublicationRequestState): InfoCardPublicationNotice {
  const saved = state.kind === "personal" ? "saved" : "published";
  const verb = state.kind === "personal" ? "Saving" : "Publishing";
  if (state.status === "pending") return { infoCardId: state.infoCardId, tone: "status", message: `${verb} ${named(state, false)} when the video is ready.` };
  if (state.status === "published") return { infoCardId: state.infoCardId, tone: "status", message: `${named(state)} has been ${saved}.` };
  return { infoCardId: state.infoCardId, tone: "alert", message: state.code === "INFO_MEDIA_PROCESSING_FAILED"
    ? `${named(state)} was not ${saved}: its video could not be processed. Open it to choose another file.`
    : `${named(state)} was not ${saved}. Open it to try again.` };
}

export function buildInfoCardPublicationLayout(states: readonly PublicationRequestState[] | undefined): readonly InfoCardPublicationNotice[] {
  return (states ?? []).map(publicationNotice);
}
