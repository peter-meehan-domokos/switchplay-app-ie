"use client";

import { lazy, Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { onAuthChange } from "@/lib/authSessionEvents";
import OnboardingErrorBoundary from "./OnboardingErrorBoundary";
import { buildOnboardingLayout, initialOnboardingUi, type OnboardingStatus, type OnboardingUi } from "./onboardingLayout";
import { isEligibleRoute, isPresentationBlocked, observeIntroHosts } from "./onboardingPresentation";
import styles from "./Onboarding.module.css";

/**
 * The single, isolated onboarding layer: a sibling of the application subtree in the root layout.
 * It supplies no props, context or keys to the application, never calls router.refresh and never
 * touches learning elements. It renders nothing on the server or during hydration, and a failure in
 * its import, fetch or render only makes it disappear. Status is revalidated on eligible entry,
 * same-tab authentication changes, focus and pageshow only: no timers, polling, storage or channels.
 */
const Onboarding = lazy(() => import("./Onboarding"));
const noop = () => () => undefined;
const FOCUS_COALESCE_MS = 400;
type Reason = "entry" | "focus" | "pageshow" | "auth" | "quiet";

async function post(path: string, body: unknown) {
  try {
    const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
    return { status: response.status, body: await response.json().catch(() => null) as Record<string, unknown> | null };
  } catch { return { status: 0, body: null }; }
}

export default function OnboardingHost() {
  const pathname = usePathname();
  const mounted = useSyncExternalStore(noop, () => true, () => false); // false on the server and during hydration
  const eligible = mounted && isEligibleRoute(pathname);
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [ui, setUi] = useState<OnboardingUi>(initialOnboardingUi);
  const statusRef = useRef<OnboardingStatus | null>(null);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const lastStarted = useRef(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const disconnectIntro = useRef<() => void>(() => undefined);
  const presentedFor = useRef<string | null>(null);

  const patch = useCallback((next: Partial<OnboardingUi>) => setUi(current => ({ ...current, ...next })), []);
  /** Identity-bound state (drafts, dismissals, messages) never survives an account change. */
  const resetIdentity = useCallback((keepInteraction = true) => setUi(current => ({ ...initialOnboardingUi, outsideInteraction: keepInteraction && current.outsideInteraction, blocked: current.blocked })), []);

  const recompute = useCallback(() => {
    const blocked = isPresentationBlocked(document);
    setUi(current => (current.blocked === blocked ? current : { ...current, blocked }));
  }, []);
  const evaluate = useCallback(() => {
    recompute();
    disconnectIntro.current();
    disconnectIntro.current = observeIntroHosts(document, recompute); // rebound each time: the intro hosts may mount later
  }, [recompute]);

  const refresh = useCallback(async (reason: Reason) => {
    const now = Date.now();
    if ((reason === "focus" || reason === "pageshow") && now - lastStarted.current < FOCUS_COALESCE_MS) return;
    lastStarted.current = now;
    const mine = ++generation.current;
    controller.current?.abort();
    const abort = new AbortController(); controller.current = abort;
    // An explicit sign-in or sign-out is a new session: the click that caused it is not "learning in progress".
    if (reason === "auth") { statusRef.current = null; setStatus(null); resetIdentity(false); }
    // Sensitive content is concealed (not merely disabled) while identity is re-confirmed.
    else if (reason !== "quiet" && statusRef.current) patch({ confirming: true });
    try {
      const response = await fetch("/api/account/onboarding", { cache: "no-store", signal: abort.signal });
      if (mine !== generation.current) return; // a newer request or account change superseded this one
      if (response.status === 401) { statusRef.current = null; setStatus(null); resetIdentity(); return; }
      if (!response.ok) throw new Error("unavailable");
      const next = await response.json() as OnboardingStatus;
      if (mine !== generation.current) return;
      if (statusRef.current && statusRef.current.actorId !== next.actorId) resetIdentity();
      statusRef.current = next; setStatus(next);
      patch({ confirming: false, unavailable: false });
      evaluate();
    } catch {
      // Uncertain network: stay hidden. A previous person's data is never shown to an unconfirmed identity.
      if (mine === generation.current && !abort.signal.aborted) patch({ confirming: false, unavailable: true });
    }
  }, [evaluate, patch, resetIdentity]);

  useEffect(() => {
    if (!eligible) return;
    // Watch for outside interaction before awaiting anything. Passive, bubbling, never cancelling anything.
    const outside = (event: Event) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setUi(current => (current.outsideInteraction ? current : { ...current, outsideInteraction: true }));
      requestAnimationFrame(evaluate);
    };
    const reasons = ["pointerdown", "keydown", "wheel"] as const;
    reasons.forEach(name => document.addEventListener(name, outside, { passive: true }));
    const onFocus = () => { void refresh("focus"); evaluate(); };
    const onPageShow = () => { void refresh("pageshow"); evaluate(); };
    window.addEventListener("focus", onFocus); window.addEventListener("pageshow", onPageShow); document.addEventListener("fullscreenchange", evaluate);
    const stopAuth = onAuthChange(() => { void refresh("auth"); });
    // Started from a microtask so the effect itself never sets state synchronously.
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) { evaluate(); void refresh("entry"); } });
    return () => {
      cancelled = true;
      reasons.forEach(name => document.removeEventListener(name, outside));
      window.removeEventListener("focus", onFocus); window.removeEventListener("pageshow", onPageShow); document.removeEventListener("fullscreenchange", evaluate);
      stopAuth(); disconnectIntro.current(); disconnectIntro.current = () => undefined;
      generation.current += 1; controller.current?.abort(); // late responses can never render after leaving
    };
  }, [eligible, evaluate, refresh]);

  const layout = buildOnboardingLayout(eligible ? status : null, ui);

  // The welcome is acknowledged only once it has actually been presented, and never for a collapsed control.
  useEffect(() => {
    if (layout.kind !== "welcome" || !status || presentedFor.current === status.actorId) return;
    presentedFor.current = status.actorId;
    patch({ welcomePresented: true });
    void post("/api/account/onboarding", { action: "acknowledge", expectedUserId: status.actorId }); // failure only means it may show again
  }, [layout.kind, status, patch]);

  const send = useCallback(async () => {
    const actor = statusRef.current?.actorId, email = ui.draft.trim();
    if (!actor || !email || ui.sending) return;
    patch({ sending: true, message: null });
    const result = await post("/api/account/parental-approval", { action: "request", guardianEmail: email, expectedUserId: actor });
    if (statusRef.current?.actorId !== actor) return; // the account changed meanwhile: nothing from this response may show
    if (result.status === 200) {
      patch({ sending: false, draft: "", message: { text: typeof result.body?.message === "string" ? result.body.message : "Request sent.", tone: "info" } });
      void refresh("quiet");
    } else if (result.status === 401 || result.status === 409 && result.body?.code === "ACTOR_MISMATCH") {
      void refresh("auth");
    } else {
      patch({ sending: false, message: { text: result.status === 0 ? "We couldn't reach Puckle. Your entry is still here. Please try again." : typeof result.body?.error === "string" ? result.body.error : "Something went wrong. Please try again.", tone: "error" } });
    }
  }, [patch, refresh, ui.draft, ui.sending]);

  if (!eligible) return null;
  return (
    <div className={styles.root} data-onboarding-host="" ref={rootRef}>
      <OnboardingErrorBoundary>
        <Suspense fallback={null}>
          <Onboarding actions={{
            setDraft: value => patch({ draft: value }), send: () => void send(), openWelcome: () => patch({ openedByRequest: true }),
            explore: () => patch({ welcomeDismissed: true }),
            requestSession: () => { patch({ welcomeDismissed: true }); window.location.assign("/#early-access"); },
            dismissReminder: () => patch({ reminderDismissed: true }),
          }} layout={layout} ui={ui} />
        </Suspense>
      </OnboardingErrorBoundary>
    </div>
  );
}
