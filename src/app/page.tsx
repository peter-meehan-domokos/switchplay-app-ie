import AuthScreen from "@/components/auth/AuthScreen";
import AppShell from "@/components/layout/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { mergeDeckTemplatesWithUserData } from "@/lib/deckData";
import { serverDeckDataItemsToClientDeckDataSteps } from "@/lib/deckApiTransforms";
import { deckTemplates } from "@/mocks/deckTemplates";
import { mockSocialUsers } from "@/mocks/mockSocialUsers";
import { mockUserDeckData } from "@/mocks/mockUserDeckData";
import { getVisibleDeckTemplatesForUser } from "@/mocks/templateAccess";

const USE_MOCK_DATA = false;
const mockUsernames = ['dev', 'Michael']

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) {
    return <AuthScreen />;
  }



  const serverDeckData = USE_MOCK_DATA || mockUsernames.includes(user.username) ? mockUserDeckData : user.decksData;
  const decksData = serverDeckDataItemsToClientDeckDataSteps(serverDeckData);
  const visibleDeckTemplates = getVisibleDeckTemplatesForUser(user.username, deckTemplates);
  const renderDecks = mergeDeckTemplatesWithUserData(visibleDeckTemplates, decksData, user.id);

  // Authenticated user identity is handled separately from social users.
  // Social users will come from a dedicated lookup layer, but mock social data
  // can be enabled for design and UI testing.
  const users = USE_MOCK_DATA
    ? [
        {
          id: user.id,
          name: user.username,
        },
        ...mockSocialUsers,
      ]
    : [];

  return (
    <>
      <AppShell
        currentUserId={user.id}
        decks={renderDecks}
        userName={user.username}
        users={users}
      />
    </>
  );
}
