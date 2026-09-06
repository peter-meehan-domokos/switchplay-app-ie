import type { DeckLayout } from "@/components/decks/deckLayout";
import type { VideoPlaybackIntent } from "@/components/media/videoPlaybackState";
import { isCloudflareStreamVideoMediaItem, type CloudflareStreamVideoMediaItem } from "@/lib/media";

export type DeckIntroPlaybackStatus = "idle" | "loading" | "playing" | "paused" | "ended" | "blocked" | "failed";

export type DeckIntroPreviewState = {
  activeDeckId: string | null;
  intent: VideoPlaybackIntent;
  status: DeckIntroPlaybackStatus;
  visibleDeckId: string | null;
};

export type DeckIntroPreviewAction =
  | { type: "activate"; deckId: string }
  | { type: "playing"; deckId: string }
  | { type: "paused"; deckId: string }
  | { type: "ended"; deckId: string }
  | { type: "blocked"; deckId: string }
  | { type: "failed"; deckId: string }
  | { type: "clear" }
  | { type: "reconcile"; deckIds: readonly string[] };

export const initialDeckIntroPreviewState: DeckIntroPreviewState = {
  activeDeckId: null,
  intent: "idle",
  status: "idle",
  visibleDeckId: null,
};

export function getPlayableDeckIntroductionVideo(
  deck: Pick<DeckLayout, "introduction">,
): CloudflareStreamVideoMediaItem | null {
  const video = deck.introduction?.video ?? null;

  return isCloudflareStreamVideoMediaItem(video) ? video : null;
}

export function getDeckTileActions(deck: Pick<DeckLayout, "introduction">) {
  return {
    frontCard: getPlayableDeckIntroductionVideo(deck) ? "preview" as const : "open" as const,
    title: "open" as const,
  };
}

export function getContainedIntroVideoSize(
  mediaItem: Pick<CloudflareStreamVideoMediaItem, "width" | "height">,
  containerAspectRatio = 0.72,
) {
  const videoAspectRatio = mediaItem.width && mediaItem.height
    ? mediaItem.width / mediaItem.height
    : 9 / 16;

  if (videoAspectRatio <= containerAspectRatio) {
    return {
      heightPercentage: 100,
      widthPercentage: (videoAspectRatio / containerAspectRatio) * 100,
    };
  }

  return {
    heightPercentage: (containerAspectRatio / videoAspectRatio) * 100,
    widthPercentage: 100,
  };
}

export function reduceDeckIntroPreviewState(
  state: DeckIntroPreviewState,
  action: DeckIntroPreviewAction,
): DeckIntroPreviewState {
  if (action.type === "clear") {
    return initialDeckIntroPreviewState;
  }

  if (action.type === "reconcile") {
    return state.activeDeckId && !action.deckIds.includes(state.activeDeckId)
      ? initialDeckIntroPreviewState
      : state;
  }

  if (action.type === "activate") {
    return {
      activeDeckId: action.deckId,
      intent: "continue",
      status: "loading",
      visibleDeckId: null,
    };
  }

  if (state.activeDeckId !== action.deckId) {
    return state;
  }

  if (action.type === "playing") {
    return {
      ...state,
      intent: "continue",
      status: "playing",
      visibleDeckId: action.deckId,
    };
  }

  if (action.type === "paused") {
    return {
      ...state,
      intent: "paused",
      status: "paused",
    };
  }

  if (action.type === "ended") {
    return {
      ...state,
      status: "ended",
    };
  }

  return {
    ...state,
    intent: "paused",
    status: action.type,
    visibleDeckId: null,
  };
}
