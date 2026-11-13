// Presentation only: the one place that decides how an Info Card type looks. A card's type is fixed
// by where it was created, never by who is viewing it, so the same card has the same colour and
// label in standalone Cards, Group Experiences and the stack strips behind the top card.
export type InfoCardType = "creator" | "personal" | "groupAdmin";
export type InfoCardTypeLayout = { type: InfoCardType; label: string; stripBackground: string };

const LAYOUTS: Record<InfoCardType, InfoCardTypeLayout> = {
  creator: { type: "creator", label: "Creator", stripBackground: "linear-gradient(145deg, #303947, #252d39)" },
  personal: { type: "personal", label: "Personal", stripBackground: "#305047" },
  groupAdmin: { type: "groupAdmin", label: "Group", stripBackground: "#147d6c" },
};
// Used behind the stack for a card that is no longer available.
export const UNAVAILABLE_STRIP_BACKGROUND = "#2c3543";

export function infoCardType(card: { personal?: boolean; infoType?: InfoCardType }): InfoCardType {
  return card.infoType ?? (card.personal ? "personal" : "creator");
}
export function buildInfoCardTypeLayout(type: InfoCardType): InfoCardTypeLayout { return LAYOUTS[type]; }
