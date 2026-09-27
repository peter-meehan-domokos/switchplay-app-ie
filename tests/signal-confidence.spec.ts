import { expect, test } from "@playwright/test";
import { getDeckConfidenceScore } from "../src/lib/signals";

test("getDeckConfidenceScore handles edge cases", () => {
  const c = (rawReading: number | null | unknown) => ({ signals: [{ rawReading }] });

  expect(getDeckConfidenceScore([])).toBeNull();
  expect(getDeckConfidenceScore([{ signals: [] }])).toBeNull();
  
  expect(getDeckConfidenceScore([c(null), c(null)])).toBeNull();
  
  expect(getDeckConfidenceScore([c(1)])).toBe(1);
  expect(getDeckConfidenceScore([c(10)])).toBe(10);
  
  expect(getDeckConfidenceScore([c(1), c(null), c(10)])).toBe(6);
  expect(getDeckConfidenceScore([c(4.25), c(6.75)])).toBe(6);
  
  expect(getDeckConfidenceScore([c(4.74), c(4.74)])).toBe(5);
  
  // Malformed data
  expect(getDeckConfidenceScore([c(1), c(NaN), c(11), c(0), c("string")])).toBe(1);
});
