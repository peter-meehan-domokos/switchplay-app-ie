"use client";

import type { PublicationPresentation } from "./creatorPublicationPresentation";

export default function CreatorPublishControl({ label, state, onPublish, onBlocked }: {
  label: string;
  state: PublicationPresentation;
  onPublish: () => void;
  onBlocked: (reason: string) => void;
}) {
  if (!state.visible) return null;

  return <button aria-label={`Publish ${label}`} aria-busy={state.publishing || state.busy}
    className={`creator-save-button${state.outstanding ? "" : " creator-save-button--published"}`}
    type="button" disabled={state.publishing || state.busy || (!state.eligible && !state.blockedReason)}
    onClick={() => state.blockedReason ? onBlocked(state.blockedReason) : onPublish()}>
    {state.publishing ? "Publishing…" : state.cleanPublished ? "Published" : "Publish"}
    {state.blockedReason ? <svg className="creator-publish-lock" viewBox="0 0 16 16" aria-label="Publication blocked" role="img">
      <rect x="3.5" y="7" width="9" height="7" rx="1.5" />
      <path d="M5.5 7V4a2.5 2.5 0 0 1 5 0v3" />
    </svg> : null}
  </button>;
}
