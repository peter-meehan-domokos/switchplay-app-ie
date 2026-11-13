import type { OpenCardMedia } from "@/lib/cardMediaViewer";
import type { VisualPersistence } from "@/lib/interactiveVisuals/persistence";
import { stepMediaItems } from "@/lib/stepMedia";
import { selectedStepMedia, stepVideoPreparations } from "@/lib/stepMediaPresentation";
import { activateVideoSession, readVideoSessionPosition, saveVideoSessionPosition, videoPositionKey } from "@/lib/videoSessionPositions";
import { createInstructionalImageResources } from "@/lib/instructionalImageResources";
import StepMediaTabs from "./StepMediaTabs";
import InstructionalImage from "./InstructionalImage";
import InteractiveVisualPreview from "@/components/interactiveVisuals/InteractiveVisualPreview";
import { useVisualLearningRecords } from "@/components/interactiveVisuals/VisualLearningRecordsProvider";
import { cloneElement, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type ReactElement } from "react";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import type { Transition } from "motion/react";
import { createCardPlaybackGrants } from "@/lib/cardPlaybackGrants";
import { createCardVideoThumbnails } from "@/lib/cardVideoThumbnails";
import PreparedVideoPoster from "@/components/media/PreparedVideoPoster";
import { useDeckVideoResource } from "@/components/media/DeckVideoPreparation";
import { publishedVideoGuard } from "@/components/media/publishedVideo";
import ActiveCardFront from "@/components/cards/ActiveCardFront";
import CardCreatorAttribution from "@/components/cards/CardCreatorAttribution";
import { hasPersonalCard, isExperienceCard, cardPresentationIdentity, type PresentedCard } from "./presentation";
import PerspectiveExchange from "@/components/group-experiences/PerspectiveExchange";
import CloudflareHlsVideoPlayer, { type CloudflareHlsVideoPlayerHandle, type VideoPlaybackIntent } from "@/components/media/CloudflareHlsVideoPlayer";
import StepView, { type StepViewInfoCards, type StepViewItem } from "@/components/decks/StepView";
import InfoCardConsultation, { type InfoCardConsultationCard } from "@/components/info-cards/InfoCardConsultation";
import { loadInfoConsultation, type ConsultationRequest } from "@/components/info-cards/infoCardConsultationClient";
import type { PersonalInfoSource, PublicationRequestState } from "@/lib/infoCards/model";
import { useDeckGestures } from "@/components/decks/gestures/useDeckGestures";
import type { GestureCommitment, GestureVector } from "@/components/decks/gestures/gestureTypes";
import { getCloudflareStreamThumbnailUrl } from "@/lib/cloudflareStreamPlayback";
import {
  isCloudflareStreamVideoMediaItem,
  isKnownLandscapeCloudflareStreamVideoMediaItem,
  isKnownPortraitCloudflareStreamVideoMediaItem,
  type MediaItem,
} from "@/lib/media";
import { dateOnlyToUtcDate } from "@/lib/dateOnly";
import {
  CARD_ASPECT_RATIO,
  CARD_HEIGHT_RATIO,
  FOCUSED_CARD_BASELINE_WIDTH,
  FOCUSED_CARD_HORIZONTAL_PADDING,
  FOCUSED_CARD_MAX_VISUAL_WIDTH,
  FOCUSED_CARD_MIN_VISUAL_WIDTH,
  FOCUSED_CARD_PREFERRED_VISUAL_WIDTH,
  FOCUSED_CARD_STAGE_WIDTH,
  FOCUSED_CARD_VERTICAL_PADDING,
} from "@/constants/cardStack";

export type FocusedCardViewProps = {
  comparisonFraction?: number;
  onFaceChange?: (rotationY: number) => void;
  personalDraftId?: string;
  /** Explicit override for the internal review; production uses the account-scoped provider. */
  interactiveVisualPersistence?: VisualPersistence;
  onOpenMedia?: OpenCardMedia;
  mediaViewerOpen?: boolean;
  card: PresentedCard;
  playbackViewerUserId?: string;
  cardIndex: number;
  deckTemplateId: string;
  deckVersion?: number;
  isDeckFlipped: boolean;
  totalCards: number;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onCycleStepStatus?: (stepId: string) => void;
  onAdjustTargetDate?: (direction: -1 | 1) => void;
  backFace?: ReactElement<{ onSignalNavigateNext?: () => void; onSignalNavigatePrevious?: () => void; onOpenMedia?: OpenCardMedia }>;
  overlays?: ReactNode;
  stepViewInfoCards?: StepViewInfoCards;
  stepViewMediaPreview?: ReactNode;
  infoCards?: readonly InfoCardConsultationCard[];
  renderStepActivity?: (item: StepViewItem) => ReactNode;
  assessment?: ReactNode;
  frontAction?: ReactNode;
  interactionLocked?: boolean;
  onPreparationBusyChange?: (busy: boolean) => void;
  onRequestAddComment?: () => void;
  traversalDirection: FocusedTraversalDirection;
  transition: Transition;
};

export type FocusedTraversalDirection = "next" | "previous";

type FocusedFlipSide = "front" | "back";

type FocusedFlipState = {
  cardId: string;
  side: FocusedFlipSide;
  rotationY: number;
};

type StepViewState = {
  cardId: string;
  itemIndex: number;
  attachmentId?: string;
};

type VideoHostRect = {
  height: number;
  left: number;
  top: number;
  width: number;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
});

const FOCUSED_FLIP_LOCK_MS = 680;
const FOCUSED_TRAVERSAL_LOCK_MS = 280;
const FALLBACK_FOCUSED_CARD_SCALE = FOCUSED_CARD_PREFERRED_VISUAL_WIDTH / FOCUSED_CARD_BASELINE_WIDTH;

function getDeckFlipSide(isDeckFlipped: boolean): FocusedFlipSide {
  return isDeckFlipped ? "back" : "front";
}

function getDeckFlipRotation(isDeckFlipped: boolean) {
  return isDeckFlipped ? 180 : 0;
}

function getStepViewSequence(card: PresentedCard): StepViewItem[] {
  return [
    { type: "intro" },
    ...card.steps.map((_, stepIndex) => ({ type: "step" as const, stepIndex })),
  ];
}

function getStepViewMediaItem(card: PresentedCard, item: StepViewItem, attachmentId?: string): MediaItem | null {
  const attachment = selectedStepMedia(item.type === "intro" ? card.intro : card.steps[item.stepIndex], attachmentId);
  return attachment && attachment.kind !== "activity" ? attachment.media : null;
}

function toVideoHostRect(rect: DOMRect): VideoHostRect {
  return {
    height: rect.height,
    left: rect.left,
    top: rect.top,
    width: rect.width,
  };
}

function isVideoHostRectEqual(currentRect: VideoHostRect | null, nextRect: VideoHostRect) {
  if (!currentRect) {
    return false;
  }

  const epsilon = 0.5;

  return (
    Math.abs(currentRect.left - nextRect.left) <= epsilon &&
    Math.abs(currentRect.top - nextRect.top) <= epsilon &&
    Math.abs(currentRect.width - nextRect.width) <= epsilon &&
    Math.abs(currentRect.height - nextRect.height) <= epsilon
  );
}

function isValidVideoHostRect(rect: VideoHostRect) {
  return Number.isFinite(rect.left) && Number.isFinite(rect.top) && rect.width > 1 && rect.height > 1;
}

const focusedTraversalVariants = {
  enter: (direction: FocusedTraversalDirection) => ({
    opacity: 0.84,
    y: direction === "next" ? 14 : -14,
  }),
  center: {
    opacity: 1,
    y: 0,
  },
  exit: (direction: FocusedTraversalDirection) => ({
    opacity: 0.78,
    y: direction === "next" ? -16 : 16,
  }),
};

function getViewportSize() {
  if (typeof window === "undefined") {
    return null;
  }

  return {
    width: window.visualViewport?.width ?? window.innerWidth,
    height: window.visualViewport?.height ?? window.innerHeight,
  };
}

function getFocusedCardScale(viewportSize: { width: number; height: number } | null, comparisonFraction = 0) {
  if (!viewportSize) {
    return FALLBACK_FOCUSED_CARD_SCALE;
  }

  const availableWidth = Math.max(0, viewportSize.width - FOCUSED_CARD_HORIZONTAL_PADDING);
  const availableHeight = Math.max(0, viewportSize.height * (1 - comparisonFraction) - FOCUSED_CARD_VERTICAL_PADDING);
  const heightConstrainedWidth = availableHeight / CARD_HEIGHT_RATIO;
  const fitVisualWidth = Math.min(
    FOCUSED_CARD_PREFERRED_VISUAL_WIDTH,
    FOCUSED_CARD_MAX_VISUAL_WIDTH,
    availableWidth,
    heightConstrainedWidth
  );
  const minReadableWidth = Math.min(FOCUSED_CARD_MIN_VISUAL_WIDTH, availableWidth, heightConstrainedWidth);
  const focusedVisualWidth = Math.max(minReadableWidth, fitVisualWidth);

  return focusedVisualWidth / FOCUSED_CARD_BASELINE_WIDTH;
}

function useFocusedCardScale(comparisonFraction = 0) {
  const [focusedCardScale, setFocusedCardScale] = useState(() => getFocusedCardScale(getViewportSize(), comparisonFraction));

  useEffect(() => {
    const updateFocusedCardScale = () => {
      setFocusedCardScale(getFocusedCardScale(getViewportSize(), comparisonFraction));
    };

    updateFocusedCardScale();
    window.addEventListener("resize", updateFocusedCardScale);
    window.visualViewport?.addEventListener("resize", updateFocusedCardScale);

    return () => {
      window.removeEventListener("resize", updateFocusedCardScale);
      window.visualViewport?.removeEventListener("resize", updateFocusedCardScale);
    };
  }, [comparisonFraction]);

  return focusedCardScale;
}

function CardBackSlot({ content, onNext, onPrevious, onOpenMedia }: {
  onOpenMedia?: OpenCardMedia;
  content: NonNullable<FocusedCardViewProps["backFace"]>;
  onNext: () => void;
  onPrevious: () => void;
}) {
  return cloneElement(content, { onSignalNavigateNext: onNext, onSignalNavigatePrevious: onPrevious, onOpenMedia });
}

export default function FocusedCardView({
  personalDraftId,
  interactiveVisualPersistence,
  onOpenMedia, mediaViewerOpen = false,
  card,
  deckTemplateId,
  deckVersion,
  cardIndex,
  comparisonFraction = 0,
  onFaceChange,
  isDeckFlipped: requestedDeckFlip,
  totalCards,
  onClose,
  onPrevious,
  onNext,
  onCycleStepStatus,
  onAdjustTargetDate,
  backFace,
  overlays,
  stepViewInfoCards,
  stepViewMediaPreview,
  infoCards,
  renderStepActivity,
  frontAction,
  assessment,
  playbackViewerUserId,
  interactionLocked = false,
  onPreparationBusyChange,
  onRequestAddComment,
  traversalDirection,
  transition,
}: FocusedCardViewProps) {
  const visualRecords = useVisualLearningRecords();
  const visualPersistence = interactiveVisualPersistence ?? visualRecords.service;
  const isPresent = useIsPresent();
  const consultationId = useId();
  const mediaId = useId();
  const [stepViewElement, setStepViewElement] = useState<HTMLElement | null>(null);
  const [consultation, setConsultation] = useState<{ identity: string; cards: InfoCardConsultationCard[]; source: HTMLElement;
    status: "pending" | "ready" | "failed"; showLoading: boolean; request?: ConsultationRequest; selectedId?: string; personalSources?: PersonalInfoSource[];
    publications?: PublicationRequestState[] } | null>(null);
  const refreshAbort = useRef<AbortController | null>(null);
  const recoveryOpened = useRef(false);
  const canonicalVersion = hasPersonalCard(card) ? null : card.version;
  const videoGuard = useMemo(() => canonicalVersion === null ? undefined : publishedVideoGuard("card", card.cardTemplateId!, canonicalVersion), [card.cardTemplateId, canonicalVersion]);
  const isDeckFlipped = Boolean(backFace) && requestedDeckFlip;
  const contentIdentity = cardPresentationIdentity(card);
  const playbackActor = hasPersonalCard(card) ? card.dataOwnerUserId : playbackViewerUserId;
  const playbackVersion = hasPersonalCard(card) ? card.adoptedVersion : card.version;
  const playbackMode = hasPersonalCard(card) ? "working" : "canonical";
  const instructionalImages = useMemo(() => createInstructionalImageResources(playbackActor, {
    ...(card.cardTemplateId && playbackVersion ? { owner: { cardTemplateId: card.cardTemplateId, version: playbackVersion, mode: playbackMode } } : {}),
  }), [playbackActor, card.cardTemplateId, playbackVersion, playbackMode]);
  useEffect(() => () => instructionalImages.clear(), [instructionalImages]);
  const sharedPreparation = useDeckVideoResource(card);
  const sharedResource = sharedPreparation.resource;
  const preparationManager = sharedPreparation.manager;
  const preparationKey = sharedPreparation.key;
  const playbackGrants = useMemo(() => sharedResource ? sharedResource.grants : process.env.NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA === "1" && playbackActor && playbackVersion
    ? createCardPlaybackGrants({ viewerUserId: playbackActor, cardTemplateId: card.cardTemplateId!, version: playbackVersion, mode: playbackMode }) : null,
    [sharedResource, playbackActor, playbackVersion, playbackMode, card.cardTemplateId]);
  const [, refreshPlaybackGrants] = useState(0);
  const thumbnails = useMemo(() => sharedResource?.thumbnails ?? createCardVideoThumbnails(() => refreshPlaybackGrants(value => value + 1)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- A fresh image store is required for each learner/Card/version, even if URLs match.
    [sharedResource, playbackActor, playbackVersion, playbackMode, card.cardTemplateId]);
  const preparePlayback = useRef<() => void>(() => {});
  useEffect(() => () => { if (!sharedResource) playbackGrants?.clear(); }, [playbackGrants, sharedResource]);
  useEffect(() => () => { if (!sharedResource) thumbnails.clear(); }, [thumbnails, sharedResource]);
  useEffect(() => {
    preparationManager?.focus(preparationKey);
    return () => { preparationManager?.setVideoOpen(false); preparationManager?.focus(null); };
  }, [preparationManager, preparationKey]);
  const resolvePlayback = useMemo(() => playbackGrants ? async (media: import("@/lib/media").CloudflareStreamVideoMediaItem, signal: AbortSignal) => {
    const grant = await playbackGrants.read(media, signal);
    if (!signal.aborted && document.visibilityState !== "hidden") thumbnails.prepare(grant);
    refreshPlaybackGrants(value => value + 1);
    preparePlayback.current();
    return grant;
  } : undefined, [playbackGrants, thumbnails]);
  const [flipState, setFlipState] = useState<FocusedFlipState>({
    cardId: card.id,
    side: isDeckFlipped ? "back" : "front",
    rotationY: isDeckFlipped ? 180 : 0,
  });
  const [stepViewState, setStepViewState] = useState<StepViewState | null>(() => personalDraftId ? { cardId: card.id, itemIndex: 0 } : null);
  const [isVideoExpanded, setIsVideoExpanded] = useState(false);
  const [videoAnchorElement, setVideoAnchorElement] = useState<HTMLDivElement | null>(null);
  const [videoHostRect, setVideoHostRect] = useState<VideoHostRect | null>(null);
  const [expandedLandscapeFrameSize, setExpandedLandscapeFrameSize] = useState<{ width: number; height: number } | null>(null);
  const [renderableVideoAssetId, setRenderableVideoAssetId] = useState<string | null>(null);
  const [decodedVideoAssetId, setDecodedVideoAssetId] = useState<string | null>(null);
  const [failedVideoAssetId, setFailedVideoAssetId] = useState<string | null>(null);
  const [fadingPosterAssetId, setFadingPosterAssetId] = useState<string | null>(null);
  const [isFocusedGestureLocked, setIsFocusedGestureLocked] = useState(false);
  const focusedGestureLockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoHostElementRef = useRef<HTMLDivElement | null>(null);
  const videoFrameElementRef = useRef<HTMLDivElement | null>(null);
  const videoPlayerRef = useRef<CloudflareHlsVideoPlayerHandle | null>(null);
  const positionOwnerRef = useRef<string | undefined>(undefined);
  const stepViewStateRef = useRef<StepViewState | null>(null);
  const videoPlaybackIntentRef = useRef<VideoPlaybackIntent>("idle");
  const updateVideoPlaybackIntent = useCallback((intent: VideoPlaybackIntent) => {
    videoPlaybackIntentRef.current = intent;
  }, []);
  const activeVideoAssetIdRef = useRef<string | null>(null);
  const focusedCardScale = useFocusedCardScale(comparisonFraction);
  const deckSideFlipState: FocusedFlipState = {
    cardId: card.id,
    side: getDeckFlipSide(isDeckFlipped),
    rotationY: getDeckFlipRotation(isDeckFlipped),
  };
  const cardFlipState = flipState.cardId === card.id ? flipState : deckSideFlipState;
  const isFlipped = cardFlipState.side === "back";
  const preparationDestination = stepViewState?.cardId === card.id ? [card.intro, ...card.steps][stepViewState.itemIndex] : undefined;
  const preparationAttachments = preparationDestination ? stepMediaItems(preparationDestination) : [];
  const preparationIndex = preparationAttachments.length > 1 && preparationAttachments.some(item => item.kind === "video") ? stepViewState?.itemIndex : undefined;
  const preparationAttachmentId = preparationIndex === undefined ? undefined : stepViewState?.attachmentId;
  // A legacy/single-media step change keeps the exact existing preparation pool
  // and must not abort pending grant/thumbnail work merely because state moved.
  const instructionalVideos = useMemo(() => stepVideoPreparations([card.intro, ...card.steps], preparationIndex === undefined
    ? undefined : { index: preparationIndex, attachmentId: preparationAttachmentId }), [card.intro, card.steps, preparationIndex, preparationAttachmentId]);
  useEffect(() => {
    if (isFlipped) { preparePlayback.current = () => {}; return; }
    let preparation: AbortController | null = null, preparing = false, live = true;
    const start = () => {
      if (!live || document.visibilityState === "hidden" || preparing) return;
      const controller = new AbortController(); preparation = controller; preparing = true;
      const onGrant = (grant: import("@/lib/cardPlaybackGrants").PlaybackGrant) => {
        if (!live || controller.signal.aborted) return;
        thumbnails.prepare(grant); refreshPlaybackGrants(value => value + 1);
      };
      if (!playbackGrants) for (const media of instructionalVideos) thumbnails.prepare({ assetId: media.assetId,
        thumbnailUrl: getCloudflareStreamThumbnailUrl(media), reuseUntil: Infinity, expiresAt: Infinity });
      void Promise.allSettled([playbackGrants?.prepare(instructionalVideos, controller.signal, onGrant),
        ...instructionalVideos.map(media => videoGuard?.prepare?.(media, controller.signal))]).then(() => {
        if (live && !controller.signal.aborted) refreshPlaybackGrants(value => value + 1);
      }).finally(() => { if (preparation === controller) preparing = false; });
    };
    const visibility = () => {
      if (document.visibilityState === "hidden") {
        preparation?.abort(); thumbnails.cancelPending(); preparing = false;
      } else start();
    };
    preparePlayback.current = start;
    document.addEventListener("visibilitychange", visibility);
    start();
    return () => {
      live = false; preparation?.abort();
      thumbnails.cancelPending(sharedResource?.card.intro ? [sharedResource.card.intro.assetId] : []);
      preparePlayback.current = () => {};
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [playbackGrants, thumbnails, instructionalVideos, isFlipped, videoGuard, sharedResource]);
  const stepViewSequence = getStepViewSequence(card);
  const stepViewItemIndex =
    stepViewState?.cardId === card.id && !isFlipped
      ? Math.min(stepViewState.itemIndex, stepViewSequence.length - 1)
      : null;
  const stepViewItem = stepViewItemIndex === null ? null : stepViewSequence[stepViewItemIndex] ?? null;
  const stepDestination = stepViewItem?.type === "intro" ? card.intro : stepViewItem?.type === "step" ? card.steps[stepViewItem.stepIndex] : null;
  const attachments = stepDestination ? stepMediaItems(stepDestination) : [];
  const selectedAttachment = selectedStepMedia(stepDestination ?? undefined, stepViewState?.attachmentId);
  const mediaPanelId = `${mediaId}-${stepViewItemIndex}`;
  const stepActivity = (stepViewItem ? renderStepActivity?.(stepViewItem) : null) ??
    (selectedAttachment?.kind === "activity" ? !interactiveVisualPersistence && visualRecords.unavailable ? <p>Interactive visual unavailable.</p> : <InteractiveVisualPreview
      key={`${contentIdentity}:${stepViewItemIndex}:${selectedAttachment.id}`} activityId={selectedAttachment.activityId} persistence={visualPersistence}
      origin={{ kind: "card", cardId: card.cardTemplateId ?? card.id, cardVersion: playbackVersion, mode: playbackMode, deckId: deckTemplateId,
        ...(deckVersion !== undefined ? { deckVersion } : {}),
        stepId: stepViewItem?.type === "step" ? card.steps[stepViewItem.stepIndex]?.stepId : "intro", attachmentId: selectedAttachment.id }}
      onOpen={() => { videoPlayerRef.current?.setPlaybackSuspended(true); updateVideoPlaybackIntent("paused"); }} />
      : selectedAttachment?.kind === "image" ? <InstructionalImage key={`${contentIdentity}:${stepViewItemIndex}:${selectedAttachment.id}`}
        alt={selectedAttachment.alt} resources={instructionalImages} context={playbackActor && playbackVersion && deckVersion && card.cardTemplateId ? {
          viewerUserId: playbackActor, cardTemplateId: card.cardTemplateId, version: playbackVersion, mode: playbackMode,
          deckTemplateId, deckVersion, stepId: stepViewItem?.type === "step" ? card.steps[stepViewItem.stepIndex]?.stepId : "intro", attachmentId: selectedAttachment.id,
        } : undefined} /> : null);
  const consultationIdentity = JSON.stringify([contentIdentity, playbackActor, deckTemplateId, stepViewItemIndex]);
  // Me in a Group reads and creates the viewer own Follower contribution Info Cards (checkpoint 4.2); the Group
  // perspective and Other followers keep the canonical Creator Info Cards until checkpoint 4.3.
  const groupMe = isExperienceCard(card) && card.perspective === "self" && typeof card.accessEpoch === "number";
  const groupNotes = infoCards === undefined && groupMe && card.canWriteLearning && !!playbackActor && !!playbackVersion;
  const personalEnabled = infoCards === undefined && hasPersonalCard(card) && !!playbackActor && !!playbackVersion && card.permissions?.canMutateCardData === true
    || groupNotes;
  const personalCount = hasPersonalCard(card) ? (card.personalInfoCardIds?.length ?? 0)
    + (card.personalHistory ?? []).filter(source => source.cardTemplateId !== card.id).reduce((sum, source) => sum + (source.personalInfoCardIds?.length ?? 0), 0) : 0;
  const attachmentCount = infoCards !== undefined ? infoCards.length : (card.infoCardIds?.length ?? 0) + (personalEnabled ? personalCount : 0);
  const consultationOpen = Boolean(consultation && consultation.identity === consultationIdentity && stepViewItem && stepViewElement && isPresent && !mediaViewerOpen);
  useEffect(() => { onPreparationBusyChange?.(isFocusedGestureLocked || !!stepViewItem || consultationOpen); }, [onPreparationBusyChange, isFocusedGestureLocked, stepViewItem, consultationOpen]);
  if (consultation && (consultation.identity !== consultationIdentity || !stepViewItem || !isPresent || mediaViewerOpen)) setConsultation(null);
  const consultationRequest = consultation?.request;
  useEffect(() => {
    if (!consultationRequest) return;
    const abort = new AbortController();
    const timer = setTimeout(() => setConsultation(current => current?.request === consultationRequest && current.status === "pending"
      ? { ...current, showLoading: true } : current), 1000);
    void loadInfoConsultation(consultationRequest, abort.signal, snapshot => setConsultation(current => current?.request === consultationRequest
      ? { ...current, personalSources: snapshot.personalSources, publications: snapshot.publications } : current)).then(cards => {
      if (!abort.signal.aborted) setConsultation(current => current?.request === consultationRequest
        ? { ...current, cards, status: "ready", showLoading: false } : current);
    }).catch(() => {
      if (!abort.signal.aborted) setConsultation(current => current?.request === consultationRequest
        ? { ...current, status: "failed", showLoading: false } : current);
    }).finally(() => clearTimeout(timer));
    return () => { clearTimeout(timer); abort.abort(); refreshAbort.current?.abort(); };
  }, [consultationRequest, consultationIdentity]);
  const activeStepViewMediaItem = stepViewItem && !stepActivity ? getStepViewMediaItem(card, stepViewItem, stepViewState?.attachmentId) : null;
  const activeCloudflareVideoMediaItem =
    activeStepViewMediaItem && isCloudflareStreamVideoMediaItem(activeStepViewMediaItem)
      ? activeStepViewMediaItem
      : null;
  const isExpandedVideoPortrait =
    activeCloudflareVideoMediaItem ? isKnownPortraitCloudflareStreamVideoMediaItem(activeCloudflareVideoMediaItem) : false;
  const isExpandedVideoLandscape =
    activeCloudflareVideoMediaItem ? isKnownLandscapeCloudflareStreamVideoMediaItem(activeCloudflareVideoMediaItem) : false;
  const activeVideoAssetId = activeCloudflareVideoMediaItem?.assetId ?? null;
  const isVideoHostVisible = Boolean(activeCloudflareVideoMediaItem && (isVideoExpanded || videoHostRect));
  const positionKeyFor = (state: StepViewState | null) => {
    const item = state && state.cardId === card.id ? stepViewSequence[state.itemIndex] : undefined;
    const destination = item?.type === "intro" ? card.intro : item?.type === "step" ? card.steps[item.stepIndex] : undefined;
    const attachment = selectedStepMedia(destination, state?.attachmentId);
    return attachment?.kind === "video" ? videoPositionKey(card.cardTemplateId ?? card.id,
      item?.type === "step" ? card.steps[item.stepIndex].stepId : "intro", attachment.id, attachment.media) : undefined;
  };
  const activePositionKey = positionKeyFor(stepViewState);
  const captureVideoPosition = () => {
    const key = positionKeyFor(stepViewStateRef.current), position = videoPlayerRef.current?.getPosition();
    if (key && position) saveVideoSessionPosition(playbackActor, key, position.currentTime);
  };
  useLayoutEffect(() => { activateVideoSession(playbackActor); }, [playbackActor]);
  useLayoutEffect(() => {
    // Capture the handle while mounted: React clears the forwarded ref during
    // deletion, but the outgoing Card still owns its last source position.
    const player = videoPlayerRef.current;
    positionOwnerRef.current = activePositionKey;
    return () => {
      const position = player?.getPosition();
      if (activePositionKey && positionOwnerRef.current === activePositionKey && position?.assetId === activeVideoAssetId) saveVideoSessionPosition(playbackActor, activePositionKey, position.currentTime);
    };
  }, [activePositionKey, activeVideoAssetId, playbackActor, isVideoHostVisible]);
  useLayoutEffect(() => {
    if (!isVideoExpanded) return;
    const host = videoHostElementRef.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    host?.querySelector<HTMLButtonElement>("button[aria-label='Close enlarged video']")?.focus({ preventScroll: true });
    const nativeFullscreen = () => Boolean(document.fullscreenElement ||
      (host?.querySelector("video") as (HTMLVideoElement & { webkitDisplayingFullscreen?: boolean }) | null)?.webkitDisplayingFullscreen);
    const retainFocus = (event: FocusEvent) => {
      if (!nativeFullscreen() && event.target instanceof Node && !host?.contains(event.target)) host?.focus({ preventScroll: true });
    };
    const keydown = (event: KeyboardEvent) => {
      if (nativeFullscreen()) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setIsVideoExpanded(false); return; }
      if (event.key !== "Tab" || !host) return;
      const controls = [...host.querySelectorAll<HTMLElement>("video[controls], button:not(:disabled)")];
      const first = controls[0], last = controls.at(-1), active = document.activeElement;
      if (!controls.includes(active as HTMLElement) || (event.shiftKey && active === first) || (!event.shiftKey && active === last)) {
        event.preventDefault(); (event.shiftKey ? last : first)?.focus({ preventScroll: true });
      }
    };
    document.addEventListener("keydown", keydown, true);
    document.addEventListener("focusin", retainFocus, true);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", keydown, true);
      document.removeEventListener("focusin", retainFocus, true);
      queueMicrotask(() => host?.querySelector<HTMLButtonElement>("button[aria-label='Expand video']")?.focus({ preventScroll: true }));
    };
  }, [isVideoExpanded]);
  useEffect(() => {
    preparationManager?.setVideoOpen(activeVideoAssetId !== null);
  }, [preparationManager, activeVideoAssetId]);
  const activeGrant = activeCloudflareVideoMediaItem ? (playbackGrants ? playbackGrants.peek(activeCloudflareVideoMediaItem.assetId)
    : { assetId: activeCloudflareVideoMediaItem.assetId, thumbnailUrl: getCloudflareStreamThumbnailUrl(activeCloudflareVideoMediaItem), reuseUntil: Infinity, expiresAt: Infinity }) : null;
  const activeThumbnail = activeGrant ? thumbnails.peek(activeGrant) : undefined;
  const hasPosterFallback = activeThumbnail?.state === "ready";
  const isCurrentVideoRenderable = Boolean(activeVideoAssetId && renderableVideoAssetId === activeVideoAssetId && failedVideoAssetId !== activeVideoAssetId);
  const isCurrentVideoFailed = Boolean(activeVideoAssetId && failedVideoAssetId === activeVideoAssetId);
  const isPosterFadeOutActive = Boolean(
    activeVideoAssetId && isCurrentVideoRenderable && fadingPosterAssetId === activeVideoAssetId
  );
  const shouldConcealCloudflarePlayer = Boolean(
    activeVideoAssetId && decodedVideoAssetId !== activeVideoAssetId
  );
  const shouldShowVideoPoster = Boolean(hasPosterFallback && (!isCurrentVideoRenderable || isPosterFadeOutActive));
  const dateLabel = hasPersonalCard(card) ? dateFormatter.format(dateOnlyToUtcDate(card.targetDate)) : "";
  const isFirstCard = cardIndex === 0;
  const isFinalCard = cardIndex === totalCards - 1;
  const focusedCardTransition: Transition = {
    layout: transition,
    opacity: { duration: 0.22, ease: "easeOut" },
    y: { duration: 0.24, ease: "easeOut" },
  };
  const flipTransition: Transition = {
    duration: 0.68,
    ease: [0.22, 0.72, 0.18, 1],
  };
  const lockFocusedGestures = (durationMs: number) => {
    if (focusedGestureLockTimeoutRef.current) {
      clearTimeout(focusedGestureLockTimeoutRef.current);
    }

    setIsFocusedGestureLocked(true);
    focusedGestureLockTimeoutRef.current = setTimeout(() => {
      setIsFocusedGestureLocked(false);
      focusedGestureLockTimeoutRef.current = null;
    }, durationMs);
  };
  const resetVideoDisplayState = useCallback(() => {
    setDecodedVideoAssetId(null);
    setRenderableVideoAssetId(null);
    setFailedVideoAssetId(null);
    setFadingPosterAssetId(null);
  }, [setDecodedVideoAssetId, setRenderableVideoAssetId, setFailedVideoAssetId, setFadingPosterAssetId]);
  const toggleFocusedCardSide = (commitment: GestureCommitment, vector: GestureVector) => {
    if (isFocusedGestureLocked || consultationOpen) {
      return;
    }

    lockFocusedGestures(FOCUSED_FLIP_LOCK_MS);
    const delta = commitment.direction === "right" || (!commitment.direction && vector.x > 0) ? 180 : -180;
    onFaceChange?.(cardFlipState.rotationY + delta);
    setFlipState((currentFlipState) => {
      const currentCardFlipState =
        currentFlipState.cardId === card.id ? currentFlipState : deckSideFlipState;
      const directionDelta =
        commitment.direction === "right" || (!commitment.direction && vector.x > 0)
          ? 180
          : -180;

      return {
        cardId: card.id,
        side: currentCardFlipState.side === "front" ? "back" : "front",
        rotationY: currentCardFlipState.rotationY + directionDelta,
      };
    });
  };
  const settleFocusedCardToPast = () => {
    if (isFocusedGestureLocked || isFinalCard || consultationOpen) {
      return;
    }

    lockFocusedGestures(FOCUSED_TRAVERSAL_LOCK_MS);
    onNext();
  };
  const restoreFocusedCardFromPast = () => {
    if (isFocusedGestureLocked || isFirstCard || consultationOpen) {
      return;
    }

    lockFocusedGestures(FOCUSED_TRAVERSAL_LOCK_MS);
    onPrevious();
  };
  const openStepView = (stepIndex: number) => {
    if (isFlipped || consultationOpen) {
      return;
    }

    preparationManager?.setVideoOpen(isCloudflareStreamVideoMediaItem(getStepViewMediaItem(card, { type: "step", stepIndex })));

    const nextStepViewState = {
      cardId: card.id,
      itemIndex: stepIndex + 1,
    };

    stepViewStateRef.current = nextStepViewState;
    updateVideoPlaybackIntent("idle");
    resetVideoDisplayState();
    setIsVideoExpanded(false);
    setStepViewState(nextStepViewState);
  };
  const openIntroView = () => {
    if (isFlipped || consultationOpen) {
      return;
    }

    preparationManager?.setVideoOpen(isCloudflareStreamVideoMediaItem(getStepViewMediaItem(card, { type: "intro" })));

    const nextStepViewState = {
      cardId: card.id,
      itemIndex: 0,
    };

    stepViewStateRef.current = nextStepViewState;
    updateVideoPlaybackIntent("idle");
    resetVideoDisplayState();
    setIsVideoExpanded(false);
    setStepViewState(nextStepViewState);
  };
  const closeStepView = () => {
    if (consultationOpen) return;
    captureVideoPosition();
    positionOwnerRef.current = undefined;
    videoPlayerRef.current?.pauseAndReset();
    stepViewStateRef.current = null;
    activeVideoAssetIdRef.current = null;
    updateVideoPlaybackIntent("idle");
    setIsVideoExpanded(false);
    setVideoHostRect(null);
    setVideoAnchorElement(null);
    setStepViewState(null);
  };
  function transitionStepViewMedia(nextMediaItem: MediaItem | null, nextState: StepViewState) {
    captureVideoPosition();
    positionOwnerRef.current = positionKeyFor(nextState);
    const video = isCloudflareStreamVideoMediaItem(nextMediaItem) ? nextMediaItem : null;
    const shouldContinuePlayback = videoPlaybackIntentRef.current === "continue";
    setIsVideoExpanded(false);
    if (video) {
      preparationManager?.setVideoOpen(true);
      const sameSource = activeVideoAssetIdRef.current === video.assetId;
      activeVideoAssetIdRef.current = video.assetId;
      // The player deliberately reuses an identical source. Clearing its display
      // here would wait for a new decoded callback that need not happen.
      if (!sameSource) resetVideoDisplayState();
      const key = positionKeyFor(nextState);
      videoPlayerRef.current?.loadMedia(video, { shouldPlay: shouldContinuePlayback,
        startAt: key ? readVideoSessionPosition(playbackActor, key) ?? 0 : 0 });
    } else {
      activeVideoAssetIdRef.current = null;
      videoPlayerRef.current?.pauseAndReset();
      resetVideoDisplayState(); updateVideoPlaybackIntent("idle");
      preparationManager?.setVideoOpen(false);
    }
  }
  function selectStepMedia(attachmentId: string) {
    const current = stepViewStateRef.current;
    if (!current || current.cardId !== card.id || consultationOpen) return;
    const item = stepViewSequence[current.itemIndex];
    const destination = item?.type === "intro" ? card.intro : item?.type === "step" ? card.steps[item.stepIndex] : undefined;
    const attachment = destination && stepMediaItems(destination).find(entry => entry.id === attachmentId);
    if (!attachment || selectedStepMedia(destination, current.attachmentId)?.id === attachmentId) return;
    const next = { ...current, attachmentId };
    transitionStepViewMedia(attachment.kind === "activity" ? null : attachment.media, next);
    stepViewStateRef.current = next; setStepViewState(next);
  }
  const goToStepViewItem = (direction: -1 | 1) => {
    const currentStepViewState = stepViewStateRef.current;

    if (!currentStepViewState || currentStepViewState.cardId !== card.id || consultationOpen) {
      return;
    }

    const nextItemIndex = Math.max(
      0,
      Math.min(stepViewSequence.length - 1, currentStepViewState.itemIndex + direction)
    );

    if (nextItemIndex === currentStepViewState.itemIndex) {
      return;
    }

    const nextStepViewItem = stepViewSequence[nextItemIndex];
    const nextMediaItem = nextStepViewItem ? getStepViewMediaItem(card, nextStepViewItem) : null;
    const nextStepViewState = {
      ...currentStepViewState,
      itemIndex: nextItemIndex,
      attachmentId: undefined,
    };
    transitionStepViewMedia(nextMediaItem, nextStepViewState);

    stepViewStateRef.current = nextStepViewState;
    setStepViewState(nextStepViewState);
  };
  const goToPreviousStepViewItem = () => {
    goToStepViewItem(-1);
  };
  const goToNextStepViewItem = () => {
    goToStepViewItem(1);
  };
  const openConsultation = () => {
    if (!stepViewElement || !stepViewItem || !attachmentCount && !personalEnabled || consultationOpen || interactionLocked || mediaViewerOpen) return;
    const source = stepViewElement.querySelector<HTMLElement>("[data-info-card-pouch]");
    if (!source) return;
    source.focus({ preventScroll: true });
    videoPlayerRef.current?.setPlaybackSuspended(true);
    updateVideoPlaybackIntent("paused");
    setConsultation({ identity: consultationIdentity, source, showLoading: false,
      status: infoCards ? "ready" : playbackActor && playbackVersion ? "pending" : "failed",
      cards: infoCards ? structuredClone([...infoCards]) : [],
      ...(!infoCards && playbackActor && playbackVersion ? { request: { actor: playbackActor,
        mainCardId: card.cardTemplateId!, version: playbackVersion, mode: groupMe ? "experience" as const : playbackMode,
        ...(playbackMode === "working" ? { deckTemplateId } : {}), ...(groupMe ? { experienceId: card.experienceId } : {}),
        attachmentIds: [...(card.infoCardIds ?? [])] } } : {}) });
  };
  useEffect(() => {
    if (!personalDraftId || recoveryOpened.current || !personalEnabled || !stepViewElement) return;
    recoveryOpened.current = true; openConsultation();
    // Explicit one-shot recovery entry; ordinary Step View navigation is unchanged.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personalDraftId, personalEnabled, stepViewElement, consultationIdentity]);
  const handleStepViewRef = useCallback((element: HTMLElement | null) => {
    // An outgoing animated Step View can detach after the next one has mounted.
    // Its null callback must not erase the current consultation anchor.
    // Rebind for each selection, including reversal to a retained outgoing view.
    if (element && stepViewItemIndex !== null) setStepViewElement(element);
  }, [stepViewItemIndex, setStepViewElement]);
  const handleVideoAnchorRef = useCallback((nextAnchorElement: HTMLDivElement | null) => {
    // Ignore transient null callbacks during re-render so the hosted player remains mounted.
    if (!nextAnchorElement || stepViewItemIndex === null) {
      return;
    }

    setVideoAnchorElement((currentAnchorElement) => (currentAnchorElement === nextAnchorElement ? currentAnchorElement : nextAnchorElement));
    // Rebind on selection, including when reversing to a view still animating
    // out. Its retained DOM must become the anchor again without a player remount.
  }, [stepViewItemIndex, setVideoAnchorElement]);
  const focusedGestures = useDeckGestures({
    mode: "focus",
    allowedIntents: backFace ? ["settleToPast", "restoreFromPast", "flip"] : ["settleToPast", "restoreFromPast"],
    locked:
      isFocusedGestureLocked ||
      Boolean(stepViewItem) ||
      mediaViewerOpen || interactionLocked || consultationOpen ||
      isVideoExpanded,
    onSettleToPast: settleFocusedCardToPast,
    onRestoreFromPast: restoreFocusedCardFromPast,
    onFlip: toggleFocusedCardSide,
  });

  useLayoutEffect(() => {
    stepViewStateRef.current = stepViewState;
    activeVideoAssetIdRef.current = activeVideoAssetId;
  }, [activeVideoAssetId, isDeckFlipped, stepViewState]);

  const [displayedAssetId, setDisplayedAssetId] = useState(activeVideoAssetId);
  if (displayedAssetId !== activeVideoAssetId) {
    setDecodedVideoAssetId(null);
    setDisplayedAssetId(activeVideoAssetId);
    setRenderableVideoAssetId(null);
    setFailedVideoAssetId(null);
    setFadingPosterAssetId(null);
    if (!activeVideoAssetId) {
      setIsVideoExpanded(false);
      setExpandedLandscapeFrameSize(null);
      setVideoHostRect(null);
      setVideoAnchorElement(null);
    }
  }
  useEffect(() => {
    if (!activeCloudflareVideoMediaItem) {
      videoPlayerRef.current?.pauseAndReset();
      activeVideoAssetIdRef.current = null;
      updateVideoPlaybackIntent("idle");
    }
  }, [activeCloudflareVideoMediaItem, updateVideoPlaybackIntent]);
  useEffect(() => {
    if (!activeVideoAssetId || !hasPosterFallback || !isCurrentVideoRenderable) return;
    const fadeTimeout = window.setTimeout(() => {
      setFadingPosterAssetId((currentAssetId) => currentAssetId === activeVideoAssetId ? null : currentAssetId);
    }, 250);
    return () => window.clearTimeout(fadeTimeout);
  }, [activeVideoAssetId, hasPosterFallback, isCurrentVideoRenderable]);

  if ((!isVideoExpanded || isExpandedVideoPortrait) && expandedLandscapeFrameSize !== null) {
    setExpandedLandscapeFrameSize(null);
  }
  useLayoutEffect(() => {
    if (!isVideoExpanded || isExpandedVideoPortrait) return;

    const updateExpandedLandscapeFrameSize = () => {
      const hostElement = videoHostElementRef.current;

      if (!hostElement) {
        return;
      }

      const hostRect = hostElement.getBoundingClientRect();

      if (hostRect.width <= 1 || hostRect.height <= 1) {
        return;
      }

      const viewportSize = getViewportSize();
      const shouldFitLandscapeViewport =
        isExpandedVideoLandscape && viewportSize !== null && viewportSize.width > viewportSize.height;
      const nextWidth = Math.max(
        1,
        Math.round(shouldFitLandscapeViewport ? Math.min(hostRect.width, hostRect.height * (16 / 9)) : hostRect.width)
      );
      const nextHeight = Math.max(1, Math.round(Math.min(hostRect.height, nextWidth * (9 / 16))));

      setExpandedLandscapeFrameSize((currentSize) => {
        if (currentSize && currentSize.width === nextWidth && currentSize.height === nextHeight) {
          return currentSize;
        }

        return {
          width: nextWidth,
          height: nextHeight,
        };
      });
    };

    updateExpandedLandscapeFrameSize();

    const hostElement = videoHostElementRef.current;
    if (!hostElement) {
      return;
    }

    const resizeObserver = new ResizeObserver(updateExpandedLandscapeFrameSize);
    resizeObserver.observe(hostElement);
    window.addEventListener("resize", updateExpandedLandscapeFrameSize);
    window.visualViewport?.addEventListener("resize", updateExpandedLandscapeFrameSize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateExpandedLandscapeFrameSize);
      window.visualViewport?.removeEventListener("resize", updateExpandedLandscapeFrameSize);
    };
  }, [isExpandedVideoLandscape, isVideoExpanded, isExpandedVideoPortrait]);

  useLayoutEffect(() => {
    if (!videoAnchorElement) {
      return;
    }

    let isDisposed = false;
    let animationFrameId: number | null = null;

    const updateVideoHostRect = () => {
      const nextRect = toVideoHostRect(videoAnchorElement.getBoundingClientRect());

      if (!isValidVideoHostRect(nextRect)) {
        return;
      }

      setVideoHostRect((currentRect) => (isVideoHostRectEqual(currentRect, nextRect) ? currentRect : nextRect));
    };

    const sampleVideoHostRect = () => {
      if (isDisposed) {
        return;
      }

      updateVideoHostRect();
      animationFrameId = window.requestAnimationFrame(sampleVideoHostRect);
    };

    updateVideoHostRect();
    animationFrameId = window.requestAnimationFrame(sampleVideoHostRect);

    const resizeObserver = new ResizeObserver(updateVideoHostRect);
    resizeObserver.observe(videoAnchorElement);
    window.addEventListener("resize", updateVideoHostRect);
    window.visualViewport?.addEventListener("resize", updateVideoHostRect);

    return () => {
      isDisposed = true;
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateVideoHostRect);
      window.visualViewport?.removeEventListener("resize", updateVideoHostRect);
    };
  }, [videoAnchorElement]);

  const [displayedContentIdentity, setDisplayedContentIdentity] = useState(contentIdentity);
  const [displayedDeckFlip, setDisplayedDeckFlip] = useState(isDeckFlipped);
  if (displayedContentIdentity !== contentIdentity) {
    setDecodedVideoAssetId(null);
    setDisplayedContentIdentity(contentIdentity);
    setDisplayedDeckFlip(isDeckFlipped);
    setFlipState({ cardId: card.id, side: getDeckFlipSide(isDeckFlipped), rotationY: getDeckFlipRotation(isDeckFlipped) });
    setIsVideoExpanded(false);
    setExpandedLandscapeFrameSize(null);
    setRenderableVideoAssetId(null);
    setFailedVideoAssetId(null);
    setFadingPosterAssetId(null);
    setVideoHostRect(null);
    setVideoAnchorElement(null);
    setStepViewState(null);
  } else if (displayedDeckFlip !== isDeckFlipped) {
    setDisplayedDeckFlip(isDeckFlipped);
    const targetSide = getDeckFlipSide(isDeckFlipped);
    if (flipState.side !== targetSide) setFlipState({ ...flipState, side: targetSide,
      rotationY: flipState.rotationY + (targetSide === "back" ? 180 : -180) });
  }
  useEffect(() => {
    videoPlayerRef.current?.pauseAndReset();
    stepViewStateRef.current = null;
    activeVideoAssetIdRef.current = null;
    updateVideoPlaybackIntent("idle");
  }, [contentIdentity, updateVideoPlaybackIntent]);

  useEffect(() => {
    return () => {
      if (focusedGestureLockTimeoutRef.current) {
        clearTimeout(focusedGestureLockTimeoutRef.current);
      }
    };
  }, []);

  return (
    <motion.div
      className="focused-card-layer"
      inert={consultationOpen}
      aria-hidden={consultationOpen || undefined}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, paddingBottom: comparisonFraction ? `${comparisonFraction * 100}dvh` : "18px" }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <motion.button type="button" className="focused-card-scrim" inert={isVideoExpanded} onClick={() => { if (!consultationOpen) onClose(); }} aria-label="Close focused card" />
      <AnimatePresence mode="popLayout" initial={false} custom={traversalDirection}>
        <motion.article
          key={card.id}
          className="focused-card-stage"
          inert={isVideoExpanded}
          layout
          layoutId={`week-card-${cardPresentationIdentity(card)}`}
          style={{ width: FOCUSED_CARD_STAGE_WIDTH, aspectRatio: CARD_ASPECT_RATIO }}
          custom={traversalDirection}
          variants={focusedTraversalVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={focusedCardTransition}
        >
          <PerspectiveExchange kind="focused" identity={isExperienceCard(card) ? card.dataIdentity : undefined}><motion.div
            className={`focused-card-object${isFlipped ? " is-flipped" : ""}`}
            {...focusedGestures.handlers}
            initial={false}
            animate={{
              rotateY: cardFlipState.rotationY,
              scale: focusedCardScale,
              boxShadow: isFlipped
                ? "0 34px 112px rgba(0, 0, 0, 0.66)"
                : "0 32px 104px rgba(0, 0, 0, 0.64)",
            }}
            transition={flipTransition}
          >
            <div className="physical-card focused-card-surface focused-card-surface--front" aria-hidden={isFlipped} inert={isFlipped}>
              <div className="focused-card-content">
                <ActiveCardFront
                  assessment={assessment}
                  card={card}
                  dateLabel={dateLabel}
                  variant="focused"
                  onCycleStepStatus={onCycleStepStatus}
                  onAdjustTargetDate={onAdjustTargetDate}
                  onOpenIntroView={openIntroView}
                  onOpenStepView={openStepView}
                  onStepNavigateNext={settleFocusedCardToPast}
                  onStepNavigatePrevious={restoreFocusedCardFromPast}
                />
              </div>
              <CardCreatorAttribution card={card} />
              {!isFlipped ? frontAction : null}
            </div>
            {backFace ? <div className="physical-card focused-card-surface focused-card-surface--back" aria-hidden={!isFlipped} inert={!isFlipped}>
              <CardBackSlot onOpenMedia={onOpenMedia ? (cardId, key, source, context, initialPage) => {
                if (!isFlipped || isFocusedGestureLocked || stepViewItem || interactionLocked || mediaViewerOpen) return;
                videoPlayerRef.current?.pauseAndReset("opening personal media viewer");
                onOpenMedia(cardId, key, source, context, initialPage);
              } : undefined} content={backFace} onNext={settleFocusedCardToPast} onPrevious={restoreFocusedCardFromPast} />
            </div> : null}
            <AnimatePresence>
              {stepViewItem && stepViewItemIndex !== null ? (
                <StepView
                  key={`${card.id}:${stepViewItemIndex}`}
                  card={card}
                  cloudflareVideoAnchorRef={handleVideoAnchorRef}
                  item={stepViewItem}
                  itemIndex={stepViewItemIndex}
                  itemCount={stepViewSequence.length}
                  onClose={closeStepView}
                  onNext={goToNextStepViewItem}
                  onPrevious={goToPreviousStepViewItem}
                  useCloudflareVideoHost={Boolean(activeCloudflareVideoMediaItem)}
                  surfaceRef={handleStepViewRef}
                  infoCards={attachmentCount || personalEnabled ? { count: consultationOpen && consultation?.status === "ready" ? consultation.cards.length : attachmentCount,
                    allowEmpty: personalEnabled, expanded: consultationOpen && consultation?.status === "ready", controlsId: consultationId, onToggle: openConsultation } : stepViewInfoCards}
                  mediaPreview={stepViewMediaPreview}
                  activity={stepActivity}
                  selectedMedia={selectedAttachment}
                  mediaTabs={attachments.length > 1 && selectedAttachment ? <StepMediaTabs items={attachments} selectedId={selectedAttachment.id} panelId={mediaPanelId} onSelect={selectStepMedia} /> : undefined}
                  mediaPanelId={mediaPanelId}
                  mediaTabIndex={attachments.findIndex(attachment => attachment.id === selectedAttachment?.id)}
                  mediaScale={focusedCardScale}
                />
              ) : null}
            </AnimatePresence>
          </motion.div></PerspectiveExchange>
        </motion.article>
      </AnimatePresence>
      {isFlipped && onRequestAddComment ? (
        <div className="focused-shared-comment-actions">
          <button className="deck-shared-comment-button" onClick={onRequestAddComment} type="button">
            Add comment
          </button>
        </div>
      ) : null}
      {isVideoHostVisible && activeCloudflareVideoMediaItem ? (
        <div className="switchplay-video-host-layer" inert={consultationOpen} aria-hidden={consultationOpen || undefined}>
          {isVideoExpanded ? <div className="switchplay-video-expanded-backdrop" /> : null}
          <div
            ref={videoHostElementRef}
            role={isVideoExpanded ? "dialog" : undefined}
            aria-modal={isVideoExpanded || undefined}
            aria-label={isVideoExpanded ? "Enlarged step video" : undefined}
            tabIndex={isVideoExpanded ? -1 : undefined}
            className={`switchplay-video-host${
              isVideoExpanded ? " switchplay-video-host--expanded" : " switchplay-video-host--embedded"
            }${isExpandedVideoPortrait ? " switchplay-video-host--portrait" : " switchplay-video-host--landscape"}${
              isExpandedVideoLandscape ? " switchplay-video-host--known-landscape" : ""
            }`}
            style={
              !isVideoExpanded && videoHostRect
                ? {
                    height: `${videoHostRect.height}px`,
                    left: `${videoHostRect.left}px`,
                    top: `${videoHostRect.top}px`,
                    width: `${videoHostRect.width}px`,
                  }
                : undefined
            }
          >
            <div
              ref={videoFrameElementRef}
              className="switchplay-video-frame"
              style={
                isVideoExpanded && !isExpandedVideoPortrait
                  ? expandedLandscapeFrameSize
                    ? {
                        height: `${expandedLandscapeFrameSize.height}px`,
                        width: `${expandedLandscapeFrameSize.width}px`,
                      }
                    : undefined
                  : undefined
              }
            >
              <div className="switchplay-video-content">
                {shouldShowVideoPoster && activeThumbnail ? (
                  <PreparedVideoPoster image={activeThumbnail.image} fading={isPosterFadeOutActive} />
                ) : null}
                {isCurrentVideoFailed || (!isCurrentVideoRenderable && !hasPosterFallback) ? (
                  <div className="switchplay-video-loading-cover">
                    <p className="cloudflare-stream-player-status" role="status">
                      {isCurrentVideoFailed ? "Video unavailable." : "Preparing video…"}
                    </p>
                  </div>
                ) : null}
                <div className="switchplay-video-player-layer" style={shouldConcealCloudflarePlayer ? { visibility: "hidden" } : undefined}>
                  <CloudflareHlsVideoPlayer
                    ref={videoPlayerRef}
                    playbackSuspended={consultationOpen}
                    displayMode={isVideoExpanded ? "expanded" : "embedded"}
                    beforeLoad={videoGuard}
                    resolvePlayback={resolvePlayback}
                    externalLoadingPresentation
                    mediaItem={activeCloudflareVideoMediaItem}
                    initialPosition={activePositionKey ? readVideoSessionPosition(playbackActor, activePositionKey) : undefined}
                    onRequestExpand={() => setIsVideoExpanded(true)}
                    onRequestCollapse={() => setIsVideoExpanded(false)}
                    onMediaDisplayStateChange={({ assetId, state }) => {
                      if (assetId !== activeVideoAssetIdRef.current) {
                        return;
                      }

                      if (state === "decoded") { setDecodedVideoAssetId(assetId); return; }

                      if (state === "renderable") {
                        setRenderableVideoAssetId(assetId);
                        setFadingPosterAssetId(assetId);
                        setFailedVideoAssetId(null);
                        return;
                      }

                      setFailedVideoAssetId(assetId);
                    }}
                    onPlaybackIntentChange={updateVideoPlaybackIntent}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {consultationOpen && consultation && stepViewElement ? <InfoCardConsultation id={consultationId}
        cards={consultation.cards} anchor={stepViewElement} source={consultation.source} status={consultation.status}
        count={consultation.status === "ready" ? consultation.cards.length : attachmentCount} loadingMessage={consultation.showLoading} actor={playbackActor} onClose={() => setConsultation(null)}
        recoveryId={personalDraftId} selectedId={consultation.selectedId}
        personalContext={groupNotes && isExperienceCard(card) ? { kind: "group", mainCardId: card.cardTemplateId, experienceId: card.experienceId, version: playbackVersion!, accessEpoch: card.accessEpoch! }
          : personalEnabled ? { mainCardId: card.id, deckTemplateId, version: playbackVersion!,
          personalInfoRevision: consultation.personalSources?.find(source => source.cardTemplateId === card.id)?.personalInfoRevision ?? 0 } : undefined}
        personalSources={consultation.personalSources} publications={consultation.publications}
        onSelect={selectedId => setConsultation(current => current && current.request === consultation.request ? { ...current, selectedId } : current)}
        onReplace={(cards, selectedId) => setConsultation(current => current && current.request === consultation.request ? { ...current, cards, selectedId } : current)}
        onRefresh={async (selectedId, successors = []) => {
          if (!consultation.request) throw new Error("Info Cards unavailable.");
          refreshAbort.current?.abort(); const abort = new AbortController(); refreshAbort.current = abort;
          let personalSources = consultation.personalSources, publications: PublicationRequestState[] | undefined;
          const cards = await loadInfoConsultation(consultation.request, abort.signal, snapshot => { personalSources = snapshot.personalSources; publications = snapshot.publications; });
          if (abort.signal.aborted) throw new DOMException("Aborted", "AbortError");
          setConsultation(current => current && current.request === consultation.request ? { ...current, cards, personalSources, publications,
            selectedId: cards.some(card => card.id === selectedId) ? selectedId : successors.find(id => cards.some(card => card.id === id)) ?? cards[0]?.id } : current);
          return cards;
        }} /> : null}
      {overlays}
    </motion.div>
  );
}
