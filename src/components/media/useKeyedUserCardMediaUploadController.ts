"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { CloudflareR2ImageMediaItem, CloudflareStreamVideoMediaItem } from "@/lib/media";
import {
  isAbortError,
  uploadImageMedia,
  uploadVideoMedia,
  validateImageUploadFile,
  validateVideoUploadFile,
  type MediaUploadTarget,
} from "@/lib/mediaUploadClient";

export type UserCardMediaUploadTarget = Extract<MediaUploadTarget, { scope: "user-card" }>;
export type UserCardMediaUploadKind = "image" | "video";

export type UserCardMediaUploadState = {
  imageError: string | null;
  imageUploadStage: "idle" | "saving" | "uploading";
  isImageUploading: boolean;
  isVideoUploading: boolean;
  videoUploadStage: "idle" | "saving" | "uploading";
  videoError: string | null;
};

export type CompletedUserCardMediaUpload =
  | {
      file: File;
      kind: "image";
      mediaItem: CloudflareR2ImageMediaItem;
      target: UserCardMediaUploadTarget;
    }
  | {
      file: File;
      kind: "video";
      mediaItem: CloudflareStreamVideoMediaItem;
      target: UserCardMediaUploadTarget;
    };

type UserCardMediaUploadAction = {
  key: string;
  kind: UserCardMediaUploadKind;
  message?: string;
  type: "clear-error" | "error" | "finish" | "saving" | "start";
};

type UserCardMediaUploadSession = {
  controller: AbortController;
  key: string;
  kind: UserCardMediaUploadKind;
  target: UserCardMediaUploadTarget;
  token: symbol;
};

type UserCardMediaUploadSessionSlots = Partial<Record<UserCardMediaUploadKind, UserCardMediaUploadSession>>;

export const initialUserCardMediaUploadState: UserCardMediaUploadState = {
  imageError: null,
  imageUploadStage: "idle",
  isImageUploading: false,
  isVideoUploading: false,
  videoUploadStage: "idle",
  videoError: null,
};

export function createUserCardMediaUploadKey(target: UserCardMediaUploadTarget) {
  return `user-card:${encodeURIComponent(target.deckTemplateId)}:${encodeURIComponent(target.cardId)}`;
}

export function getUserCardMediaUploadState(
  statesByKey: Record<string, UserCardMediaUploadState>,
  target: UserCardMediaUploadTarget,
) {
  return statesByKey[createUserCardMediaUploadKey(target)] ?? initialUserCardMediaUploadState;
}

function updateUserCardMediaUploadState(
  state: UserCardMediaUploadState,
  action: Omit<UserCardMediaUploadAction, "key">,
): UserCardMediaUploadState {
  if (action.kind === "image") {
    if (action.type === "start") {
      return { ...state, imageError: null, imageUploadStage: "uploading", isImageUploading: true };
    }
    if (action.type === "saving") {
      return { ...state, imageUploadStage: "saving" };
    }
    if (action.type === "finish") {
      return { ...state, imageUploadStage: "idle", isImageUploading: false };
    }
    if (action.type === "error") {
      return { ...state, imageError: action.message ?? "Unable to upload card image.", imageUploadStage: "idle" };
    }
    return { ...state, imageError: null };
  }

  if (action.type === "start") {
    return { ...state, isVideoUploading: true, videoError: null, videoUploadStage: "uploading" };
  }
  if (action.type === "finish") {
    return { ...state, isVideoUploading: false, videoUploadStage: "idle" };
  }
  if (action.type === "saving") {
    return { ...state, videoUploadStage: "saving" };
  }
  if (action.type === "error") {
    return { ...state, videoError: action.message ?? "Unable to upload card video.", videoUploadStage: "idle" };
  }
  return { ...state, videoError: null };
}

export function userCardMediaUploadStateReducer(
  statesByKey: Record<string, UserCardMediaUploadState>,
  action: UserCardMediaUploadAction,
) {
  const currentState = statesByKey[action.key] ?? initialUserCardMediaUploadState;

  return {
    ...statesByKey,
    [action.key]: updateUserCardMediaUploadState(currentState, action),
  };
}

export class UserCardMediaUploadSessionStore {
  private readonly sessionsByKey = new Map<string, UserCardMediaUploadSessionSlots>();

  start(target: UserCardMediaUploadTarget, kind: UserCardMediaUploadKind) {
    const immutableTarget = { ...target };
    const key = createUserCardMediaUploadKey(immutableTarget);
    const slots = this.sessionsByKey.get(key) ?? {};

    if (slots[kind]) {
      return null;
    }

    const session: UserCardMediaUploadSession = {
      controller: new AbortController(),
      key,
      kind,
      target: immutableTarget,
      token: Symbol(`${key}:${kind}`),
    };

    slots[kind] = session;
    this.sessionsByKey.set(key, slots);

    return session;
  }

  isActive(session: UserCardMediaUploadSession) {
    return this.sessionsByKey.get(session.key)?.[session.kind]?.token === session.token && !session.controller.signal.aborted;
  }

  finish(session: UserCardMediaUploadSession) {
    if (!this.isActive(session)) {
      return false;
    }

    const slots = this.sessionsByKey.get(session.key);

    if (!slots) {
      return false;
    }

    delete slots[session.kind];

    if (!slots.image && !slots.video) {
      this.sessionsByKey.delete(session.key);
    }

    return true;
  }

  abortAll() {
    for (const slots of this.sessionsByKey.values()) {
      slots.image?.controller.abort();
      slots.video?.controller.abort();
    }

    this.sessionsByKey.clear();
  }
}

type UseKeyedUserCardMediaUploadControllerOptions = {
  onUploadCompleted: (result: CompletedUserCardMediaUpload) => void | Promise<void>;
  onUploadStarted?: (target: UserCardMediaUploadTarget, kind: UserCardMediaUploadKind) => void;
};

export function useKeyedUserCardMediaUploadController({
  onUploadCompleted,
  onUploadStarted,
}: UseKeyedUserCardMediaUploadControllerOptions) {
  const [statesByKey, dispatch] = useReducer(userCardMediaUploadStateReducer, {});
  const sessionStoreRef = useRef<UserCardMediaUploadSessionStore | null>(null);

  if (sessionStoreRef.current == null) {
    sessionStoreRef.current = new UserCardMediaUploadSessionStore();
  }

  useEffect(() => {
    const sessionStore = sessionStoreRef.current;

    return () => {
      sessionStore?.abortAll();
    };
  }, []);

  const finishSession = useCallback((session: UserCardMediaUploadSession) => {
    if (!sessionStoreRef.current?.finish(session)) {
      return;
    }

    dispatch({ key: session.key, kind: session.kind, type: "finish" });
  }, []);

  const uploadImage = useCallback(async (target: UserCardMediaUploadTarget, file: File) => {
    const validationError = validateImageUploadFile(file);
    const key = createUserCardMediaUploadKey(target);

    if (validationError) {
      dispatch({ key, kind: "image", message: validationError, type: "error" });
      return;
    }

    const session = sessionStoreRef.current?.start(target, "image");

    if (!session) {
      return;
    }

    dispatch({ key: session.key, kind: "image", type: "start" });
    onUploadStarted?.(session.target, "image");

    try {
      const mediaItem = await uploadImageMedia(session.target, file, session.controller.signal);

      if (!sessionStoreRef.current?.isActive(session)) {
        return;
      }

      dispatch({ key: session.key, kind: "image", type: "saving" });
      try {
        await onUploadCompleted({ file, kind: "image", mediaItem, target: session.target });
      } catch (error) {
        throw new Error(`Image uploaded, but could not be saved. ${error instanceof Error ? error.message : "Please try again."}`);
      }
    } catch (error) {
      if (session.controller.signal.aborted || isAbortError(error)) {
        return;
      }

      dispatch({
        key: session.key,
        kind: "image",
        message: error instanceof Error ? error.message : "Unable to upload card image.",
        type: "error",
      });
    } finally {
      finishSession(session);
    }
  }, [finishSession, onUploadCompleted, onUploadStarted]);

  const uploadVideo = useCallback(async (target: UserCardMediaUploadTarget, file: File) => {
    const validationError = validateVideoUploadFile(file);
    const key = createUserCardMediaUploadKey(target);

    if (validationError) {
      dispatch({ key, kind: "video", message: validationError, type: "error" });
      return;
    }

    const session = sessionStoreRef.current?.start(target, "video");

    if (!session) {
      return;
    }

    dispatch({ key: session.key, kind: "video", type: "start" });
    onUploadStarted?.(session.target, "video");

    try {
      const mediaItem = await uploadVideoMedia(session.target, file, session.controller.signal);

      if (!sessionStoreRef.current?.isActive(session)) {
        return;
      }

      dispatch({ key: session.key, kind: "video", type: "saving" });
      try {
        await onUploadCompleted({ file, kind: "video", mediaItem, target: session.target });
      } catch (error) {
        throw new Error(`Video uploaded, but could not be saved. ${error instanceof Error ? error.message : "Please try again."}`);
      }
    } catch (error) {
      if (session.controller.signal.aborted || isAbortError(error)) {
        return;
      }

      dispatch({
        key: session.key,
        kind: "video",
        message: error instanceof Error ? error.message : "Unable to upload card video.",
        type: "error",
      });
    } finally {
      finishSession(session);
    }
  }, [finishSession, onUploadCompleted, onUploadStarted]);

  const clearImageError = useCallback((target: UserCardMediaUploadTarget) => {
    dispatch({ key: createUserCardMediaUploadKey(target), kind: "image", type: "clear-error" });
  }, []);
  const clearVideoError = useCallback((target: UserCardMediaUploadTarget) => {
    dispatch({ key: createUserCardMediaUploadKey(target), kind: "video", type: "clear-error" });
  }, []);

  return {
    clearImageError,
    clearVideoError,
    getState: (target: UserCardMediaUploadTarget) => getUserCardMediaUploadState(statesByKey, target),
    uploadImage,
    uploadVideo,
  };
}
