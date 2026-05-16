import AppShell from "@/components/layout/AppShell";
import { switchplayMockData } from "@/mocks/switchplayMockData";

export default function HomePage() {
  return <AppShell decks={switchplayMockData.user.decks} userName={switchplayMockData.user.name} />;
}
