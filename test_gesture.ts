import { DECK_GESTURE_THRESHOLDS } from "./src/components/decks/gestures/gestureThresholds";

function getSignalGestureAxis(deltaX: number, deltaY: number) {
    const absoluteX = Math.abs(deltaX);
    const absoluteY = Math.abs(deltaY);
    const axisLockRatio = DECK_GESTURE_THRESHOLDS.axisLockRatio;
    const SIGNAL_DRAG_THRESHOLD_PX = 8;
    const diagonalTolerancePx = DECK_GESTURE_THRESHOLDS.diagonalTolerancePx;

    const hasClearHorizontalLead = absoluteX - absoluteY >= diagonalTolerancePx || absoluteY <= 5;
    
    if (absoluteX >= absoluteY * axisLockRatio && hasClearHorizontalLead && absoluteX >= SIGNAL_DRAG_THRESHOLD_PX) {
        return "horizontal";
    }
    return null;
}

let session = {
    intent: "pending",
    startNormalized: 0,
    movementRangePx: 200
};

// Drag right 10px
let deltaX = 10, deltaY = 0;
let nextAxis = getSignalGestureAxis(deltaX, deltaY);
if (session.intent === "pending" && nextAxis === "horizontal") {
    session.intent = "signal"; // LOCKS
}
console.log("Move 1 (10px right) -> intent:", session.intent);

// Return left to 0px
deltaX = 0, deltaY = 0;
nextAxis = getSignalGestureAxis(deltaX, deltaY); // null, < 8px
if (session.intent === "pending" && nextAxis === "horizontal") {
    session.intent = "signal";
}
console.log("Move 2 (0px) -> intent remains:", session.intent);

// Pointer Up
const finalAxis = session.intent === "pending" ? getSignalGestureAxis(deltaX, deltaY) : null;
const finalIntent = session.intent === "signal" || finalAxis === "horizontal" ? "signal" : "cancelled";
const finalNormalized = Math.max(0, Math.min(1, session.startNormalized + deltaX / session.movementRangePx));

console.log("Pointer Up at 0px -> finalIntent:", finalIntent, "| finalNormalized:", finalNormalized);
