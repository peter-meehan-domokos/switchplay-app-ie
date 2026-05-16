import { switchplayMockData } from "@/mocks/switchplayMockData";

export type Deck = (typeof switchplayMockData.user.decks)[number];
export type WeeklyCard = Deck["cards"][number];
