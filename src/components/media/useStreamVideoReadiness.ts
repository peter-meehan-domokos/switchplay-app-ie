"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  isAbortError,
  requestStreamVideoReadiness,
  StreamVideoReadinessRequestError,
  type MediaUploadTarget,
} from "@/lib/mediaUploadClient";

export type StreamVideoReadinessState =
  | { progress?: number; status: "checking" | "processing" }
  | { status: "ready" }
  | { status: "failed" }
  | { status: "waiting" }
  | { status: "unavailable" };

const POLL_INTERVAL_MS = 3_000;
const MAX_PROCESSING_CHECKS = 40;

function getUserCardId(target: MediaUploadTarget) {
  return target.scope === "user-card" ? target.cardId : null;
}

export function useStreamVideoReadiness(target: MediaUploadTarget, assetId: string, enabled = true) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<StreamVideoReadinessState>({ status: "checking" });
  const cardId = getUserCardId(target);
  const scope = target.scope;
  const deckTemplateId = target.deckTemplateId;
  const stableTarget = useMemo(
    () => scope === "user-card" && cardId
      ? { scope: "user-card" as const, deckTemplateId, cardId }
      : { scope: "deck-introduction" as const, deckTemplateId },
    [cardId, deckTemplateId, scope],
  );

  const retry = useCallback(() => {
    setState({ status: "checking" });
    setAttempt((currentAttempt) => currentAttempt + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const controller = new AbortController();
    let timeoutId: number | null = null;
    let isDisposed = false;
    let checks = 0;

    const scheduleNextCheck = () => {
      timeoutId = window.setTimeout(() => {
        void checkStatus();
      }, POLL_INTERVAL_MS);
    };

    const checkStatus = async () => {
      try {
        const result = await requestStreamVideoReadiness(stableTarget, assetId, controller.signal);

        if (isDisposed) {
          return;
        }

        if (result.status === "ready" || result.status === "failed") {
          setState({ status: result.status });
          return;
        }

        checks += 1;

        if (checks >= MAX_PROCESSING_CHECKS) {
          setState({ status: "waiting" });
          return;
        }

        setState(result.progress === undefined ? { status: "processing" } : { progress: result.progress, status: "processing" });
        scheduleNextCheck();
      } catch (error) {
        if (isDisposed || controller.signal.aborted || isAbortError(error)) {
          return;
        }

        if (error instanceof StreamVideoReadinessRequestError && !error.retryable) {
          setState({ status: "unavailable" });
          return;
        }

        checks += 1;

        if (checks >= MAX_PROCESSING_CHECKS) {
          setState({ status: "waiting" });
          return;
        }

        setState({ status: "processing" });
        scheduleNextCheck();
      }
    };

    void checkStatus();

    return () => {
      isDisposed = true;
      controller.abort();
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [assetId, attempt, enabled, stableTarget]);

  return { retry, state };
}

export const streamVideoReadinessPolling = {
  intervalMs: POLL_INTERVAL_MS,
  maxChecks: MAX_PROCESSING_CHECKS,
};
