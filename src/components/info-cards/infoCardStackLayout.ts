import { buildInfoCardTypeLayout, infoCardType, UNAVAILABLE_STRIP_BACKGROUND, type InfoCardType } from "./infoCardTypeLayout";

// Presentation projection of the cards waiting behind the top card. Read-only: callers render it and
// never patch it. Each strip is one upcoming card, so the mixture of types in the stack is visible.
export const INFO_STACK_MAX_STRIPS = 4;
export const INFO_STACK_STRIP_REVEAL_PX = 5;
export const INFO_STACK_STRIP_INSET_PX = 4;

export type InfoCardStackStrip = { id: string; type: InfoCardType | "unavailable"; background: string;
  /** How far the strip's top edge sits above the top card's top edge. */
  offset: number; /** Horizontal inset from each side, so deeper strips recede. */ inset: number };
type StackCard = { id: string; unavailable?: boolean; personal?: boolean; infoType?: InfoCardType };

export function buildInfoCardStackLayout(cards: readonly StackCard[], index: number): readonly InfoCardStackStrip[] {
  const count = Math.min(INFO_STACK_MAX_STRIPS, Math.max(0, cards.length - 1));
  return Array.from({ length: count }, (_, position) => {
    const card = cards[(index + 1 + position) % cards.length], depth = position + 1;
    const unavailable = !!card.unavailable;
    const type = unavailable ? "unavailable" as const : infoCardType(card);
    return { id: card.id, type, background: unavailable ? UNAVAILABLE_STRIP_BACKGROUND : buildInfoCardTypeLayout(infoCardType(card)).stripBackground,
      offset: depth * INFO_STACK_STRIP_REVEAL_PX, inset: depth * INFO_STACK_STRIP_INSET_PX };
  });
}
