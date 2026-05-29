import AppShell from "@/components/layout/AppShell";
import { mergeDeckTemplatesWithUserData } from "@/lib/deckData";
import { deckTemplates } from "@/mocks/deckTemplates";
import { mockSocialUsers } from "@/mocks/mockSocialUsers";
import { mockUserDeckData } from "@/mocks/mockUserDeckData";

export default function HomePage() {
  const decks = mergeDeckTemplatesWithUserData(deckTemplates, mockUserDeckData, "user-001");

  return (
    <AppShell
      currentUserId="user-001"
      decks={decks}
      userName="Jamie O'Brien"
      users={[{ id: "user-001", name: "Jamie O'Brien" }, ...mockSocialUsers]}
    />
  );
}
