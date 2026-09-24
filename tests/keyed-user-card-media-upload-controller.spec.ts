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
  const cardASession = sessionStore.replace(cardATarget, "video");
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

test("same-card same-type replacement aborts only the earlier card-A session", () => {
  const sessionStore = new UserCardMediaUploadSessionStore();
  const firstCardASession = sessionStore.replace(cardATarget, "video");
  const replacementCardASession = sessionStore.replace(cardATarget, "video");

  expect(firstCardASession.controller.signal.aborted).toBe(true);
  expect(sessionStore.isActive(firstCardASession)).toBe(false);
  expect(sessionStore.isActive(replacementCardASession)).toBe(true);
});

test("same-type sessions on different cards do not abort one another", () => {
  const sessionStore = new UserCardMediaUploadSessionStore();
  const cardASession = sessionStore.replace(cardATarget, "video");
  const cardBSession = sessionStore.replace(cardBTarget, "video");

  expect(cardASession.controller.signal.aborted).toBe(false);
  expect(sessionStore.isActive(cardASession)).toBe(true);
  expect(sessionStore.isActive(cardBSession)).toBe(true);
});

test("the creator controller remains a single-target same-type replacement controller", () => {
  const firstCreatorSession = replaceMediaUploadSession(null, "video");
  const replacementCreatorSession = replaceMediaUploadSession(firstCreatorSession, "video");
  const started = mediaUploadControllerReducer(initialMediaUploadControllerState, { kind: "video", type: "start" });

  expect(firstCreatorSession.controller.signal.aborted).toBe(true);
  expect(replacementCreatorSession.controller.signal.aborted).toBe(false);
  expect(started.isVideoUploading).toBe(true);
});
