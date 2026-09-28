import { test, expect } from "@playwright/test";
import { getFocusedSignalDisplayState } from "@/components/decks/BackCardFaceContent";
import type { CardLayoutSignal } from "@/components/cards/cardLayout";

const mockSignal: CardLayoutSignal = {
  id: "s1",
  title: "Clarity",
  value: 0,
  reading: null,
  rawReading: null,
  variant: "movement",
  unit: null,
  order: "increasing",
};

test.describe("FocusedSignalRow visibility & label logic", () => {
  test("A null idle signal visibly renders 'Drag to set'", () => {
    const state = getFocusedSignalDisplayState(mockSignal, null, false);
    
    expect(state.isVisible).toBe(true);
    expect(state.label).toBe("Drag to set");
    expect(state.isUnset).toBe(true);
  });

  test("A numeric idle signal retains the hidden label", () => {
    // 1 normalizes to 0
    const setSignal: CardLayoutSignal = { ...mockSignal, reading: 1, rawReading: 1, value: 0 };
    const state = getFocusedSignalDisplayState(setSignal, null, false);

    expect(state.isVisible).toBe(false);
    expect(state.label).not.toBe("Drag to set");
    expect(state.label).toBe("Hang in there"); // the descriptive label for 1
    expect(state.isUnset).toBe(false);
  });

  test("A numeric signal shows its descriptive value during dragging", () => {
    const setSignal: CardLayoutSignal = { ...mockSignal, reading: 1, rawReading: 1, value: 0 };
    // dragging to the end (normalized 1.0 = reading 10)
    const state = getFocusedSignalDisplayState(setSignal, 1.0, true);

    expect(state.isVisible).toBe(true);
    expect(state.label).toBe("That's great!"); // the descriptive label for 10
    expect(state.isUnset).toBe(false);
  });

  test("An unset signal being dragged replaces 'Drag to set' with the descriptive label", () => {
    // dragging to the end (normalized 1.0 = reading 10)
    const state = getFocusedSignalDisplayState(mockSignal, 1.0, true);

    expect(state.isVisible).toBe(true);
    expect(state.label).toBe("That's great!");
    expect(state.label).not.toBe("Drag to set");
    expect(state.isUnset).toBe(false); // because previewNormalized is not null
  });

  test("A failed first save returning to null restores visible 'Drag to set'", () => {
    // Component returns to initial state after rollback
    const state = getFocusedSignalDisplayState(mockSignal, null, false);
    
    expect(state.isVisible).toBe(true);
    expect(state.label).toBe("Drag to set");
    expect(state.isUnset).toBe(true);
  });
});
