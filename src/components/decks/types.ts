import { switchplayMockData } from "@/mocks/switchplayMockData";

type MockDeck = (typeof switchplayMockData.user.decks)[number];
type MockWeeklyCard = MockDeck["cards"][number];
type MockWeeklyCardItem = MockWeeklyCard["items"][number];

export type CompletionStatus = "todo" | "inProgress" | "done" | "skipped";
export type WeeklyCardItem = Omit<MockWeeklyCardItem, "completionStatus"> & {
  completionStatus: string;
};
export type WeeklyCard = Omit<MockWeeklyCard, "items"> & {
  items: WeeklyCardItem[];
};
export type Deck = Omit<MockDeck, "cards"> & {
  cards: WeeklyCard[];
};
