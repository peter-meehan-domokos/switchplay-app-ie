import { expect, test } from "@playwright/test";
import { getSignalGestureAxis, clampNormalized } from "../src/components/decks/BackCardFaceContent";
import { normalizedToSignalReading, roundSignalReadingForStorage } from "../src/lib/signals";

function getFinalReadingFromNormalized(normalizedValue: number) {
  const reading = normalizedToSignalReading(normalizedValue);
  return roundSignalReadingForStorage(reading);
}

test("drag from null to 1 via drag-return-left", () => {
  // Simulating initial state where reading is null.
  // The UI renders at value: 0 (which maps to SIGNAL_MIN: 1)
  const startNormalized = 0; 
  const movementRangePx = 100;
  
  // 1. User starts pressing and moves right by 10px (crosses horizontal threshold)
  let deltaX = 10;
  let deltaY = 0;
  let intent: "pending" | "signal" | "cancelled" = "pending";
  
  const axis1 = getSignalGestureAxis(deltaX, deltaY);
  expect(axis1).toBe("horizontal");
  
  // Intent latches to "signal"
  intent = intent === "signal" || axis1 === "horizontal" ? "signal" : "cancelled";
  expect(intent).toBe("signal");
  
  // 2. User moves pointer back to the exact starting position (deltaX = 0)
  deltaX = 0;
  deltaY = 0;
  
  // Final intent evaluation on pointer up
  const finalAxis = intent === "pending" ? getSignalGestureAxis(deltaX, deltaY) : null;
  expect(finalAxis).toBeNull(); // Because intent is already latched
  
  const finalIntent = intent === "signal" || finalAxis === "horizontal" ? "signal" : "cancelled";
  expect(finalIntent).toBe("signal");
  
  // Final commit calculation
  const finalNormalized = clampNormalized(startNormalized + deltaX / movementRangePx);
  expect(finalNormalized).toBe(0);
  
  const finalReading = getFinalReadingFromNormalized(finalNormalized);
  expect(finalReading).toBe(1); // Safely sets 1
});
