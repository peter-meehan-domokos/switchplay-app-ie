import AuthScreen from "@/components/auth/AuthScreen";
import type { Deck } from "@/components/decks/types";
import AppShell from "@/components/layout/AppShell";
import type { AuthUser } from "@/lib/auth";
import { getCurrentUser } from "@/lib/auth";
import { switchplayMockData } from "@/mocks/switchplayMockData";

function getDecksForUser(user: AuthUser): Deck[] {
  return user.decksData.length > 0 ? user.decksData : switchplayMockData.user.decks;
}

function getCurrentUserId(user: AuthUser) {
  return user.decksData.length > 0 ? user.id : switchplayMockData.user.id;
}

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <>
      <AppShell
        currentUserId={getCurrentUserId(user)}
        decks={getDecksForUser(user)}
        userName={user.username}
        users={[
          {
            id: getCurrentUserId(user),
            name: user.username,
          },
          ...switchplayMockData.connections,
        ]}
      />
    </>
  );
}
