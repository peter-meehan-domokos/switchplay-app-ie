import assert from "node:assert/strict";
import { test } from "node:test";
import { isReminderDismissed, rememberReminderDismissed } from "../src/components/onboarding/onboardingSession";
import { welcomeSchedule, welcomeTimeline, welcomeTotalMs } from "../src/app/sites/puckle/lib/registrationWelcome";

test("the welcome enters, stays fully readable for 5 seconds, exits, and only then opens My Decks", () => {
  const timeline = welcomeTimeline(false);
  assert.deepEqual(timeline, { enterMs: 500, holdMs: 5000, exitMs: 500 }); assert.equal(welcomeTotalMs(timeline), 6000);
  assert.deepEqual(welcomeSchedule(timeline), [{ phase: "hold", at: 500 }, { phase: "exit", at: 5500 }, { phase: "navigate", at: 6000 }]);
});
test("reduced motion removes the animations but keeps the readable time", () => {
  const timeline = welcomeTimeline(true);
  assert.deepEqual(timeline, { enterMs: 0, holdMs: 5000, exitMs: 0 }); assert.equal(welcomeSchedule(timeline).at(-1)!.at, 5000);
  assert.ok(welcomeSchedule(timeline).every((step, index, steps) => index === 0 || step.at >= steps[index - 1].at), "steps are in order");
});
const fake = () => { const data = new Map<string, string>(); return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) }; };
test("reminder dismissal is remembered per account within one session store, never across accounts", () => {
  const storage = fake(); assert.equal(isReminderDismissed("a", storage), false);
  rememberReminderDismissed("a", storage);
  assert.equal(isReminderDismissed("a", storage), true); assert.equal(isReminderDismissed("b", storage), false);
  assert.equal(isReminderDismissed("a", fake()), false, "a new session starts with nothing dismissed");
});
test("blocked or throwing storage never breaks onboarding", () => {
  const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("full"); } };
  assert.equal(isReminderDismissed("a", broken), false); assert.doesNotThrow(() => rememberReminderDismissed("a", broken));
  assert.equal(isReminderDismissed("a", undefined), false); assert.doesNotThrow(() => rememberReminderDismissed("a", undefined));
});
