import AppShell from "@/components/layout/AppShell";
import { switchplayMockData } from "@/mocks/switchplayMockData";

export default function Home() {
  return (
    <AppShell
      currentUserId={switchplayMockData.user.id}
      decks={switchplayMockData.user.decks}
      userName={switchplayMockData.user.name}
      users={[{ id: switchplayMockData.user.id, name: switchplayMockData.user.name }, ...switchplayMockData.connections]}
    />
  );
}
