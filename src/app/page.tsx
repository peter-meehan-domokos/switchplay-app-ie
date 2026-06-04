import AuthScreen from "@/components/auth/AuthScreen";
import AppShell from "@/components/layout/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { mergeDeckTemplatesWithUserData } from "@/lib/deckData";
import { serverDeckDataItemsToClientDeckDataSteps } from "@/lib/deckApiTransforms";
import { getVisibleDeckTemplatesForUser } from "@/lib/deckTemplateQueries";
import { mockSocialUsers } from "@/mocks/mockSocialUsers";

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) {
    return <AuthScreen />;
  }



  const serverDeckData = user.decksData;
  const decksData = serverDeckDataItemsToClientDeckDataSteps(serverDeckData);
  const visibleDeckTemplates = await getVisibleDeckTemplatesForUser(user);
  const renderDecks = mergeDeckTemplatesWithUserData(visibleDeckTemplates, decksData, user.id);

  // Authenticated user identity is handled separately from social users.
  // Social users will come from a dedicated lookup layer, but mock social data
  // can be enabled for design and UI testing.
  const users = user.username !== 'Michael' //Michael is the only user with mock social data in this mock setup
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
