import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import DeckTile from "@/components/decks/DeckTile";
import type { DeckLayout } from "@/components/decks/deckLayout";
import {
  getContainedIntroVideoSize,
  getPlayableDeckIntroductionVideo,
  initialDeckIntroPreviewState,
  reduceDeckIntroPreviewState,
  type DeckIntroPreviewAction,
} from "@/components/decks/deckIntroPreview";
import CloudflareHlsVideoPlayer, {
  type CloudflareHlsVideoPlayerHandle,
  type VideoPlaybackState,
} from "@/components/media/CloudflareHlsVideoPlayer";

type IntroHostRect = {
  height: number;
  left: number;
  top: number;
  width: number;
};

type DeckGridProps = {
  decks: DeckLayout[];
  instantiatingDeckTemplateId: string | null;
  isInteractionLocked: boolean;
  onSelectDeck: (deckId: string) => void;
  transition: object;
};

export default function DeckGrid({
  decks,
  instantiatingDeckTemplateId,
  isInteractionLocked,
  onSelectDeck,
  transition,
}: DeckGridProps) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<CloudflareHlsVideoPlayerHandle | null>(null);
  const anchorElementsRef = useRef(new Map<string, HTMLDivElement>());
  const activeVideoRef = useRef<{ assetId: string; deckId: string } | null>(null);
  const previewStateRef = useRef(initialDeckIntroPreviewState);
  const [previewState, setPreviewState] = useState(initialDeckIntroPreviewState);
  const [isIntroExpanded, setIsIntroExpanded] = useState(false);
  const [hostRect, setHostRect] = useState<IntroHostRect | null>(null);
  const activeDeck = decks.find((deck) => deck.id === previewState.activeDeckId) ?? null;
  const activeVideo = activeDeck ? getPlayableDeckIntroductionVideo(activeDeck) : null;
  const activeVideoWidth = activeVideo?.width ?? 9;
  const activeVideoHeight = activeVideo?.height ?? 16;
  const containedVideoSize = activeVideo ? getContainedIntroVideoSize(activeVideo) : null;
  const isPlayerVisible = previewState.visibleDeckId === previewState.activeDeckId;
  const isExpandedVideoPortrait = activeVideoHeight > activeVideoWidth;
  const canExpandIntroPreview = Boolean(
    isPlayerVisible &&
    activeVideo &&
    previewState.status === "playing" &&
    !isInteractionLocked
  );

  const applyPreviewAction = useCallback((action: DeckIntroPreviewAction) => {
    const nextState = reduceDeckIntroPreviewState(previewStateRef.current, action);
    previewStateRef.current = nextState;
    setPreviewState(nextState);
  }, []);

  const updateHostRect = useCallback((deckId: string) => {
    const gridElement = gridRef.current;
    const anchorElement = anchorElementsRef.current.get(deckId);

    if (!gridElement || !anchorElement) {
      setHostRect(null);
      return;
    }

    const gridRect = gridElement.getBoundingClientRect();
    const anchorRect = anchorElement.getBoundingClientRect();
    const scaleX = gridElement.clientWidth > 0 ? gridRect.width / gridElement.clientWidth : 1;
    const scaleY = gridElement.clientHeight > 0 ? gridRect.height / gridElement.clientHeight : 1;

    setHostRect({
      height: anchorRect.height / (scaleY || 1),
      left: (anchorRect.left - gridRect.left) / (scaleX || 1),
      top: (anchorRect.top - gridRect.top) / (scaleY || 1),
      width: anchorRect.width / (scaleX || 1),
    });
  }, []);

  const clearPreview = useCallback(() => {
    console.log("[DIAG DECKGRID] clearPreview called, calling pauseAndReset");
    activeVideoRef.current = null;
    playerRef.current?.pauseAndReset("deckgrid: clearPreview");
    applyPreviewAction({ type: "clear" });
    setIsIntroExpanded(false);
    setHostRect(null);
  }, [applyPreviewAction]);

  const handleFrontCardAction = useCallback((deck: DeckLayout) => {
    if (isInteractionLocked) {
      return;
    }

    const video = getPlayableDeckIntroductionVideo(deck);

    console.log("[DIAG DECKGRID] front card action", {
      deckId: deck.id,
      hasVideo: Boolean(video),
      mediaType: video?.mediaType ?? null,
      provider: video?.provider ?? null,
      assetId: video?.assetId ?? null,
      src: video?.src ?? null,
      playerRefExists: Boolean(playerRef.current),
    });

    if (!video) {
      clearPreview();
      onSelectDeck(deck.id);
      return;
    }

    const currentState = previewStateRef.current;

    if (currentState.activeDeckId === deck.id && currentState.visibleDeckId === deck.id) {
      playerRef.current?.togglePlayback();
      return;
    }

    if (currentState.activeDeckId === deck.id && currentState.status === "failed") {
      playerRef.current?.pauseAndReset("deckgrid: retry after failed state");
    }

    activeVideoRef.current = { assetId: video.assetId, deckId: deck.id };
    applyPreviewAction({ type: "activate", deckId: deck.id });
    updateHostRect(deck.id);

    console.log("[DIAG DECKGRID] calling loadMedia", { assetId: video.assetId, src: video.src, shouldPlay: true });
    playerRef.current?.loadMedia(video, { shouldPlay: true });
  }, [applyPreviewAction, clearPreview, isInteractionLocked, onSelectDeck, updateHostRect]);

  const handleOpenDeck = useCallback((deckId: string) => {
    clearPreview();
    onSelectDeck(deckId);
  }, [clearPreview, onSelectDeck]);

  const handlePlaybackStateChange = useCallback(({ assetId, state }: { assetId: string | null; state: VideoPlaybackState }) => {
    console.log("[DIAG DECKGRID] onPlaybackStateChange", { assetId, state });
    const activeVideoIdentity = activeVideoRef.current;

    if (!activeVideoIdentity || assetId !== activeVideoIdentity.assetId) {
      return;
    }

    if (state === "playing" || state === "paused" || state === "ended" || state === "blocked" || state === "failed") {
      applyPreviewAction({ type: state, deckId: activeVideoIdentity.deckId });
    }
  }, [applyPreviewAction]);

  useLayoutEffect(() => {
    if (previewState.activeDeckId) {
      updateHostRect(previewState.activeDeckId);
    }
  }, [previewState.activeDeckId, updateHostRect]);

  useEffect(() => {
    const activeDeckId = previewStateRef.current.activeDeckId;

    if (!activeDeckId || decks.some((deck) => deck.id === activeDeckId)) {
      return;
    }

    clearPreview();
  }, [clearPreview, decks]);

  useEffect(() => {
    const activeDeckId = previewState.activeDeckId;
    const gridElement = gridRef.current;
    const anchorElement = activeDeckId ? anchorElementsRef.current.get(activeDeckId) : null;

    if (!activeDeckId || !gridElement || !anchorElement) {
      return;
    }

    const handleLayoutChange = () => updateHostRect(activeDeckId);
    const resizeObserver = new ResizeObserver(handleLayoutChange);
    resizeObserver.observe(gridElement);
    resizeObserver.observe(anchorElement);
    window.addEventListener("resize", handleLayoutChange);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleLayoutChange);
    };
  }, [previewState.activeDeckId, updateHostRect]);

  useEffect(() => {
    if (isPlayerVisible || !isIntroExpanded) {
      return;
    }

    setIsIntroExpanded(false);
  }, [isIntroExpanded, isPlayerVisible]);

  useEffect(() => {
    if (!isIntroExpanded) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsIntroExpanded(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isIntroExpanded]);

  const isHostVisible = isIntroExpanded
    ? Boolean(previewState.activeDeckId && activeVideo)
    : Boolean(isPlayerVisible && hostRect);

  const hostStyle: CSSProperties | undefined = hostRect
    ? {
        height: hostRect.height,
        left: hostRect.left,
        top: hostRect.top,
        width: hostRect.width,
      }
    : undefined;
  const embeddedPlayerFrameStyle: CSSProperties | undefined = containedVideoSize
    ? {
        height: `${containedVideoSize.heightPercentage}%`,
        width: `${containedVideoSize.widthPercentage}%`,
      }
    : undefined;
  const expandedPlayerFrameStyle: CSSProperties | undefined =
    isIntroExpanded && activeVideo
      ? {
          aspectRatio: `${activeVideoWidth} / ${activeVideoHeight}`,
        }
      : undefined;

  return (
    <div className="deck-grid" ref={gridRef}>
      {decks.map((deck) => (
        <DeckTile
          key={deck.id}
          deck={deck}
          isDisabled={isInteractionLocked}
          isIntroActive={previewState.visibleDeckId === deck.id}
          introPlaybackStatus={previewState.activeDeckId === deck.id ? previewState.status : "idle"}
          isPreparing={instantiatingDeckTemplateId === deck.deckTemplateId}
          onFrontCardAction={() => handleFrontCardAction(deck)}
          onIntroAnchorChange={(element) => {
            if (element) {
              anchorElementsRef.current.set(deck.id, element);
            } else {
              anchorElementsRef.current.delete(deck.id);
            }
          }}
          onSelect={() => handleOpenDeck(deck.id)}
          transition={transition}
        />
      ))}
      {isIntroExpanded ? <div className="deck-grid-intro-expanded-backdrop" aria-hidden="true" /> : null}
      <div
        className={`deck-grid-intro-host${isHostVisible ? " deck-grid-intro-host--visible" : ""}${
          isIntroExpanded ? " deck-grid-intro-host--expanded" : ""
        }${isExpandedVideoPortrait ? " deck-grid-intro-host--portrait" : " deck-grid-intro-host--landscape"}`}
        aria-hidden={!isHostVisible}
        style={isIntroExpanded ? undefined : hostStyle}
      >
        <div
          className={`deck-grid-intro-player-frame${isIntroExpanded ? " deck-grid-intro-player-frame--expanded" : ""}`}
          style={isIntroExpanded ? expandedPlayerFrameStyle : embeddedPlayerFrameStyle}
        >
          <CloudflareHlsVideoPlayer
            ref={playerRef}
            displayMode={isIntroExpanded ? "expanded" : "embedded"}
            mediaItem={null}
            onPlaybackStateChange={handlePlaybackStateChange}
            onRequestCollapse={isIntroExpanded ? () => setIsIntroExpanded(false) : undefined}
            onRequestExpand={canExpandIntroPreview ? () => setIsIntroExpanded(true) : undefined}
            previewControlDisabled={!isPlayerVisible}
            previewLabel={`introduction for ${activeDeck?.title ?? "deck"}`}
            variant={isIntroExpanded ? "standard" : "deck-preview"}
          />
        </div>
      </div>
    </div>
  );
}
