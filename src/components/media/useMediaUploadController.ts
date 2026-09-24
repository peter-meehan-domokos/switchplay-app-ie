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

export type CompletedMediaUpload =
  | {
      file: File;
      kind: "image";
      mediaItem: CloudflareR2ImageMediaItem;
    }
  | {
      file: File;
      kind: "video";
      mediaItem: CloudflareStreamVideoMediaItem;
    };

export type MediaUploadControllerState = {
  imageError: string | null;
  isImageUploading: boolean;
  isVideoUploading: boolean;
  videoUploadStage: "idle" | "saving" | "uploading";
  videoError: string | null;
};

type MediaUploadKind = "image" | "video";

type MediaUploadControllerAction =
  | { type: "start"; kind: MediaUploadKind }
  | { type: "saving"; kind: "video" }
  | { type: "finish"; kind: MediaUploadKind }
  | { type: "error"; kind: MediaUploadKind; message: string }
  | { type: "clear-error"; kind: MediaUploadKind };

export type MediaUploadSession = {
  controller: AbortController;
  token: symbol;
};

export const initialMediaUploadControllerState: MediaUploadControllerState = {
  imageError: null,
  isImageUploading: false,
  isVideoUploading: false,
  videoUploadStage: "idle",
  videoError: null,
};

export function mediaUploadControllerReducer(
  state: MediaUploadControllerState,
  action: MediaUploadControllerAction,
): MediaUploadControllerState {
  if (action.kind === "image") {
    if (action.type === "start") {
      return { ...state, imageError: null, isImageUploading: true };
    }
    if (action.type === "finish") {
      return { ...state, isImageUploading: false };
    }
    if (action.type === "error") {
      return { ...state, imageError: action.message };
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
    return { ...state, videoError: action.message, videoUploadStage: "idle" };
  }
  return { ...state, videoError: null };
}

export function replaceMediaUploadSession(currentSession: MediaUploadSession | null, kind: MediaUploadKind) {
  currentSession?.controller.abort();

  return {
    controller: new AbortController(),
    token: Symbol(kind),
  } satisfies MediaUploadSession;
}

export function isActiveMediaUploadSession(
  currentSession: MediaUploadSession | null,
  candidateSession: MediaUploadSession,
) {
  return currentSession?.token === candidateSession.token && !candidateSession.controller.signal.aborted;
}

type UseMediaUploadControllerOptions = {
  onUploadCompleted: (result: CompletedMediaUpload) => void | Promise<void>;
  onUploadStarted?: (kind: MediaUploadKind) => void;
  target: MediaUploadTarget;
};

export function useMediaUploadController({
  onUploadCompleted,
  onUploadStarted,
  target,
}: UseMediaUploadControllerOptions) {
  const [state, dispatch] = useReducer(mediaUploadControllerReducer, initialMediaUploadControllerState);
  const imageSessionRef = useRef<MediaUploadSession | null>(null);
  const videoSessionRef = useRef<MediaUploadSession | null>(null);

  useEffect(() => {
    return () => {
      imageSessionRef.current?.controller.abort();
      videoSessionRef.current?.controller.abort();
      imageSessionRef.current = null;
      videoSessionRef.current = null;
    };
  }, []);

  const finishImageSession = useCallback((session: MediaUploadSession) => {
    if (!isActiveMediaUploadSession(imageSessionRef.current, session)) {
      return;
    }

    imageSessionRef.current = null;
    dispatch({ type: "finish", kind: "image" });
  }, []);

  const finishVideoSession = useCallback((session: MediaUploadSession) => {
    if (!isActiveMediaUploadSession(videoSessionRef.current, session)) {
      return;
    }

    videoSessionRef.current = null;
    dispatch({ type: "finish", kind: "video" });
  }, []);

  const uploadImage = useCallback(async (file: File) => {
    const validationError = validateImageUploadFile(file);

    if (validationError) {
      dispatch({ type: "error", kind: "image", message: validationError });
      return;
    }

    const session = replaceMediaUploadSession(imageSessionRef.current, "image");
    imageSessionRef.current = session;
    dispatch({ type: "start", kind: "image" });
    onUploadStarted?.("image");

    try {
      const mediaItem = await uploadImageMedia(target, file, session.controller.signal);

      if (!isActiveMediaUploadSession(imageSessionRef.current, session)) {
        return;
      }

      finishImageSession(session);
      await onUploadCompleted({ file, kind: "image", mediaItem });
    } catch (error) {
      if (session.controller.signal.aborted || isAbortError(error)) {
        return;
      }

      dispatch({
        type: "error",
        kind: "image",
        message: error instanceof Error ? error.message : "Unable to upload intro image.",
      });
    } finally {
      finishImageSession(session);
    }
  }, [finishImageSession, onUploadCompleted, onUploadStarted, target]);

  const uploadVideo = useCallback(async (file: File) => {
    const validationError = validateVideoUploadFile(file);

    if (validationError) {
      dispatch({ type: "error", kind: "video", message: validationError });
      return;
    }

    const session = replaceMediaUploadSession(videoSessionRef.current, "video");
    videoSessionRef.current = session;
    dispatch({ type: "start", kind: "video" });
    onUploadStarted?.("video");

    try {
      const mediaItem = await uploadVideoMedia(target, file, session.controller.signal);

      if (!isActiveMediaUploadSession(videoSessionRef.current, session)) {
        return;
      }

      dispatch({ type: "saving", kind: "video" });
      await onUploadCompleted({ file, kind: "video", mediaItem });
    } catch (error) {
      if (session.controller.signal.aborted || isAbortError(error)) {
        return;
      }

      dispatch({
        type: "error",
        kind: "video",
        message: error instanceof Error ? error.message : "Unable to upload intro video.",
      });
    } finally {
      finishVideoSession(session);
    }
  }, [finishVideoSession, onUploadCompleted, onUploadStarted, target]);

  const clearImageError = useCallback(() => dispatch({ type: "clear-error", kind: "image" }), []);
  const clearVideoError = useCallback(() => dispatch({ type: "clear-error", kind: "video" }), []);

  return {
    ...state,
    clearImageError,
    clearVideoError,
    uploadImage,
    uploadVideo,
  };
}
