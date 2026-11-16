/**
 * Timeline of the welcome shown after a verified student registration, before My Decks opens.
 * The message is fully readable for HOLD_MS; the entrance and exit are short fades. With reduced
 * motion there is no animation, but the message still stays for the same readable time.
 */
export const WELCOME_ENTER_MS = 500;
export const WELCOME_HOLD_MS = 4000;
export const WELCOME_EXIT_MS = 500;
export type WelcomePhase = "enter" | "hold" | "exit";
export type WelcomeTimeline = Readonly<{ enterMs: number; holdMs: number; exitMs: number }>;
export const welcomeTimeline = (reducedMotion: boolean): WelcomeTimeline =>
  reducedMotion ? { enterMs: 0, holdMs: WELCOME_HOLD_MS, exitMs: 0 } : { enterMs: WELCOME_ENTER_MS, holdMs: WELCOME_HOLD_MS, exitMs: WELCOME_EXIT_MS };
/** My Decks opens only at the final step, after the exit has finished. */
export const welcomeSchedule = (timeline: WelcomeTimeline): readonly { phase: WelcomePhase | "navigate"; at: number }[] => [
  { phase: "hold", at: timeline.enterMs },
  { phase: "exit", at: timeline.enterMs + timeline.holdMs },
  { phase: "navigate", at: timeline.enterMs + timeline.holdMs + timeline.exitMs },
];
export const welcomeTotalMs = (timeline: WelcomeTimeline) => timeline.enterMs + timeline.holdMs + timeline.exitMs;
