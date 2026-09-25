import { expect, test } from "@playwright/test";
import {
  UserCardMediaUploadSessionStore,
  createUserCardMediaUploadKey,
  getUserCardMediaUploadState,
  userCardMediaUploadStateReducer,
  initialUserCardMediaUploadState,
} from "@/components/media/useKeyedUserCardMediaUploadController";
import {
  initialMediaUploadControllerState,
  mediaUploadControllerReducer,
  replaceMediaUploadSession,
} from "@/components/media/useMediaUploadController";

const cardATarget = {
  scope: "user-card",
  deckTemplateId: "deck-1",
  cardId: "card-a",
} as const;

const cardBTarget = {
  scope: "user-card",
  deckTemplateId: "deck-1",
  cardId: "card-b",
} as const;

test("card-A video upload state does not appear on card B", () => {
  const cardAKey = createUserCardMediaUploadKey(cardATarget);
  const states = userCardMediaUploadStateReducer({}, { key: cardAKey, kind: "video", type: "start" });

  expect(getUserCardMediaUploadState(states, cardATarget).isVideoUploading).toBe(true);
  expect(getUserCardMediaUploadState(states, cardBTarget)).toEqual(initialUserCardMediaUploadState);
});

test("card B can begin a video upload while card A is still uploading", () => {
  const cardAKey = createUserCardMediaUploadKey(cardATarget);
  const cardBKey = createUserCardMediaUploadKey(cardBTarget);
  const cardAStates = userCardMediaUploadStateReducer({}, { key: cardAKey, kind: "video", type: "start" });
  const states = userCardMediaUploadStateReducer(cardAStates, { key: cardBKey, kind: "video", type: "start" });

  expect(getUserCardMediaUploadState(states, cardATarget).isVideoUploading).toBe(true);
  expect(getUserCardMediaUploadState(states, cardBTarget).isVideoUploading).toBe(true);
});

test("returning to card A exposes its continuing upload state", () => {
  const cardAKey = createUserCardMediaUploadKey(cardATarget);
  const states = userCardMediaUploadStateReducer({}, { key: cardAKey, kind: "image", type: "start" });

  expect(getUserCardMediaUploadState(states, cardBTarget).isImageUploading).toBe(false);
  expect(getUserCardMediaUploadState(states, cardATarget).isImageUploading).toBe(true);
});

test("a completion session retains card A even while card B is visible", () => {
  const sessionStore = new UserCardMediaUploadSessionStore();
  const cardASession = sessionStore.start(cardATarget, "video")!;
  const visibleTarget = cardBTarget;

  expect(sessionStore.isActive(cardASession)).toBe(true);
  expect(cardASession.target).toEqual(cardATarget);
  expect(cardASession.target.cardId).not.toBe(visibleTarget.cardId);
});

test("upload errors are isolated by card", () => {
  const cardAKey = createUserCardMediaUploadKey(cardATarget);
  const states = userCardMediaUploadStateReducer({}, {
    key: cardAKey,
    kind: "video",
    message: "Card A failed.",
    type: "error",
  });

  expect(getUserCardMediaUploadState(states, cardATarget).videoError).toBe("Card A failed.");
  expect(getUserCardMediaUploadState(states, cardBTarget).videoError).toBeNull();
});

test("card-A saving state remains isolated from card B", () => {
  const cardAKey = createUserCardMediaUploadKey(cardATarget);
  const uploading = userCardMediaUploadStateReducer({}, { key: cardAKey, kind: "video", type: "start" });
  const states = userCardMediaUploadStateReducer(uploading, { key: cardAKey, kind: "video", type: "saving" });

  expect(getUserCardMediaUploadState(states, cardATarget)).toMatchObject({
    isVideoUploading: true,
    videoUploadStage: "saving",
  });
  expect(getUserCardMediaUploadState(states, cardBTarget)).toEqual(initialUserCardMediaUploadState);
});

test("same-card same-type start is prevented without aborting the earlier session", () => {
  const sessionStore = new UserCardMediaUploadSessionStore();
  const firstCardASession = sessionStore.start(cardATarget, "video")!;
  const secondCardASession = sessionStore.start(cardATarget, "video");

  expect(secondCardASession).toBeNull();
  expect(firstCardASession.controller.signal.aborted).toBe(false);
  expect(sessionStore.isActive(firstCardASession)).toBe(true);
  expect(sessionStore.finish(firstCardASession)).toBe(true);
  expect(sessionStore.start(cardATarget, "video")).not.toBeNull();
});

test("same-type sessions on different cards do not abort one another", () => {
  const sessionStore = new UserCardMediaUploadSessionStore();
  const cardASession = sessionStore.start(cardATarget, "video")!;
  const cardBSession = sessionStore.start(cardBTarget, "video")!;

  expect(cardASession.controller.signal.aborted).toBe(false);
  expect(sessionStore.isActive(cardASession)).toBe(true);
  expect(sessionStore.isActive(cardBSession)).toBe(true);
});

test("one card can upload image and video independently while both remain busy through saving", () => {
  const sessionStore = new UserCardMediaUploadSessionStore();
  const imageSession = sessionStore.start(cardATarget, "image")!;
  const videoSession = sessionStore.start(cardATarget, "video")!;
  const key = createUserCardMediaUploadKey(cardATarget);
  const imageUploading = userCardMediaUploadStateReducer({}, { key, kind: "image", type: "start" });
  const bothUploading = userCardMediaUploadStateReducer(imageUploading, { key, kind: "video", type: "start" });
  const imageSaving = userCardMediaUploadStateReducer(bothUploading, { key, kind: "image", type: "saving" });
  const bothSaving = userCardMediaUploadStateReducer(imageSaving, { key, kind: "video", type: "saving" });

  expect(bothSaving[key]).toMatchObject({
    isImageUploading: true,
    imageUploadStage: "saving",
    isVideoUploading: true,
    videoUploadStage: "saving",
  });
  expect(sessionStore.start(cardATarget, "image")).toBeNull();
  expect(sessionStore.start(cardATarget, "video")).toBeNull();
  expect(sessionStore.isActive(imageSession)).toBe(true);
  expect(sessionStore.isActive(videoSession)).toBe(true);
});

test("the creator controller remains a single-target same-type replacement controller", () => {
  const firstCreatorSession = replaceMediaUploadSession(null, "video");
  const replacementCreatorSession = replaceMediaUploadSession(firstCreatorSession, "video");
  const started = mediaUploadControllerReducer(initialMediaUploadControllerState, { kind: "video", type: "start" });

  expect(firstCreatorSession.controller.signal.aborted).toBe(true);
  expect(replacementCreatorSession.controller.signal.aborted).toBe(false);
  expect(started.isVideoUploading).toBe(true);
});
