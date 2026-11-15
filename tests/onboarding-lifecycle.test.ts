import assert from "node:assert/strict";
import { test } from "node:test";
import { buildOnboardingLayout, guardianLayoutFor, initialOnboardingUi, type OnboardingStatus, type OnboardingUi } from "../src/components/onboarding/onboardingLayout";
import { isEligibleRoute, isPresentationBlocked } from "../src/components/onboarding/onboardingPresentation";
import { AUTH_CHANGED_EVENT, announceAuthChange } from "../src/lib/authSessionEvents";

const approval = (over: Partial<NonNullable<OnboardingStatus["approval"]>> = {}) =>
  ({ eligibility: "eligible" as const, status: "not-requested" as const, canRequest: true, guardianEmail: null, delivery: null, ...over });
const status = (over: Partial<OnboardingStatus> = {}): OnboardingStatus => ({ actorId: "a", show: true, student: true, welcomePending: false, approval: approval(), ...over });
const ui = (over: Partial<OnboardingUi> = {}): OnboardingUi => ({ ...initialOnboardingUi, ...over });
const kind = (s: OnboardingStatus | null, u: OnboardingUi = ui()) => buildOnboardingLayout(s, u).kind;

test("only /decks and /library are eligible", () => {
  for (const ok of ["/decks", "/library"]) assert.equal(isEligibleRoute(ok), true);
  for (const no of ["/", "/creator", "/creator/new", "/progress", "/library/anything", "/decks/abc", "/login", "/step-visuals", "/contact", "/dev", "/internal", "", null, undefined]) assert.equal(isEligibleRoute(no), false, String(no));
});
test("first welcome for an eligible, unseen student: tuition and explore actions; under 16 adds optional guardian setup", () => {
  const adult = buildOnboardingLayout(status({ welcomePending: true, approval: approval({ eligibility: "not-required", canRequest: false }) }), ui());
  assert.equal(adult.kind, "welcome"); if (adult.kind === "welcome") assert.equal(adult.guardian, null);
  const young = buildOnboardingLayout(status({ welcomePending: true }), ui());
  assert.equal(young.kind, "welcome"); if (young.kind === "welcome") { assert.match(young.guardian!.intro, /under 16/); assert.match(young.guardian!.intro, /optional/); assert.equal(young.guardian!.buttonLabel, "Send approval request"); }
});
test("teachers and non-welcome accounts get no welcome; other sites get nothing", () => {
  assert.equal(kind(status({ student: false, welcomePending: true, approval: approval({ eligibility: "age-unknown", canRequest: false }) })), "none");
  assert.equal(kind({ actorId: "a", show: false }), "none"); assert.equal(kind(null), "none");
});
test("welcome outranks a reminder; dismissing it does not trigger a replacement popup", () => {
  assert.equal(kind(status({ welcomePending: true })), "welcome");
  assert.equal(kind(status({ welcomePending: false }), ui({ welcomePresented: true })), "welcome", "stays open once presented even after server marks it seen");
  assert.equal(kind(status({ welcomePending: false }), ui({ welcomePresented: true, welcomeDismissed: true })), "none");
});
test("never auto-expands over active learning: after outside interaction the welcome becomes a quiet control opened only on request", () => {
  assert.equal(kind(status({ welcomePending: true }), ui({ outsideInteraction: true })), "pill");
  assert.equal(kind(status({ welcomePending: true }), ui({ outsideInteraction: true, openedByRequest: true })), "welcome");
  assert.equal(kind(status({ welcomePending: true }), ui({ outsideInteraction: true, welcomePresented: true })), "welcome", "an already presented welcome is not collapsed");
});
test("reminders for all five approval states; approved and 16+ show nothing", () => {
  const states = { "not-requested": "reminder", pending: "reminder", declined: "reminder", withdrawn: "reminder" } as const;
  for (const [state, expected] of Object.entries(states)) assert.equal(kind(status({ approval: approval({ status: state as "pending", guardianEmail: "p•@x.com", delivery: "sent" }) })), expected, state);
  assert.equal(kind(status({ approval: approval({ status: "approved", canRequest: false }) })), "none");
  assert.equal(kind(status({ approval: approval({ eligibility: "not-required", canRequest: false }) })), "none", "turned 16: reminder ends");
  assert.equal(kind(status({ approval: approval({ eligibility: "age-unknown", canRequest: false }) })), "none", "unknown DOB is never treated as under 16 by onboarding");
  assert.equal(kind(status(), ui({ reminderDismissed: true })), "none");
});
test("pending is truthful about delivery and offers a resend; declined and withdrawn offer an explicit re-request", () => {
  const pending = guardianLayoutFor(status({ approval: approval({ status: "pending", guardianEmail: "p•@x.com", delivery: "failed" }) }), false)!;
  assert.equal(pending.buttonLabel, "Send it again"); assert.match(pending.statusLine!, /p•@x\.com/); assert.match(pending.deliveryNote!, /couldn't confirm/);
  assert.equal(guardianLayoutFor(status({ approval: approval({ status: "pending", guardianEmail: "p•@x.com", delivery: "sent" }) }), false)!.deliveryNote, null);
  for (const state of ["declined", "withdrawn"] as const) assert.equal(guardianLayoutFor(status({ approval: approval({ status: state }) }), false)!.buttonLabel, "Ask again");
});
test("anything concealing, blocking or unconfirmed shows nothing: confirming identity, unavailable endpoint, modal or intro", () => {
  for (const over of [{ confirming: true }, { unavailable: true }, { blocked: true }]) assert.equal(kind(status({ welcomePending: true }), ui(over)), "none");
});
test("presentation predicate: fullscreen, native/rendered modals and both expanded Deck intro variants block; plain pages do not", () => {
  const doc = (selectors: string[], fullscreen = false, modern = false) => ({ fullscreenElement: fullscreen ? {} as Element : null,
    querySelector: (selector: string) => (selector === "dialog:modal" ? (modern ? {} : null) : selectors.some(s => selector.includes(s)) ? {} as Element : null) });
  assert.equal(isPresentationBlocked(doc([])), false);
  assert.equal(isPresentationBlocked(doc([], true)), true); assert.equal(isPresentationBlocked(doc([], false, true)), true);
  assert.equal(isPresentationBlocked(doc(['[role="dialog"][aria-modal="true"]'])), true);
  assert.equal(isPresentationBlocked(doc([".deck-grid-intro-host--expanded"])), true); assert.equal(isPresentationBlocked(doc([".deck-intro-viewer-host--expanded"])), true);
  const throwing = { fullscreenElement: null, querySelector: (selector: string) => { if (selector === "dialog:modal") throw new Error("unsupported"); return null; } };
  assert.equal(isPresentationBlocked(throwing), false, "an unsupported selector never breaks the page");
});
test("announcing an authentication change never throws and carries no data", () => {
  announceAuthChange(); // no window in node: silently nothing
  const g = globalThis as unknown as { window?: unknown; CustomEvent?: unknown };
  const events: { type: string; detail: unknown }[] = [];
  g.window = { dispatchEvent: (e: { type: string; detail: unknown }) => { events.push(e); } };
  g.CustomEvent = class { constructor(public type: string, public detail: unknown = null) {} };
  try { announceAuthChange(); assert.deepEqual(events.map(e => [e.type, e.detail]), [[AUTH_CHANGED_EVENT, null]]); g.window = { dispatchEvent: () => { throw new Error("boom"); } }; announceAuthChange(); }
  finally { delete g.window; delete g.CustomEvent; }
});
