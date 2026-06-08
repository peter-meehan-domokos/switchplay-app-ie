import AuthScreen from "@/components/auth/AuthScreen";
import AppShell from "@/components/layout/AppShell";
import type { UserDocument } from "@/lib/auth";
import { getCurrentUser } from "@/lib/auth";
import { mergeDeckTemplatesWithUserData } from "@/lib/deckData";
import { serverDeckDataItemsToClientDeckDataSteps } from "@/lib/deckApiTransforms";
import {
  DECK_TEMPLATES_COLLECTION,
  type DeckTemplateDocument,
} from "@/lib/deckTemplateDocuments";
import { getVisibleDeckTemplatesForUser } from "@/lib/deckTemplateQueries";
import { getCollection } from "@/lib/mongodb";
import { mockSocialUsers } from "@/mocks/mockSocialUsers";

const USERS_COLLECTION = "users";

async function getAdminDecks(currentUserId: string) {
  const usersCollection = await getCollection<UserDocument>(USERS_COLLECTION);
  const templateCollection = await getCollection<DeckTemplateDocument>(DECK_TEMPLATES_COLLECTION);
  const users = await usersCollection
    .find({}, { projection: { username: 1, decksData: 1 } })
    .sort({ username: 1 })
    .toArray();
  const deckTemplateIds = [
    ...new Set(users.flatMap((deckOwner) => deckOwner.decksData.map((deckData) => deckData.deckTemplateId))),
  ];

  if (deckTemplateIds.length === 0) {
    return {
      decks: [],
      users,
    };
  }

  const templateDocuments = await templateCollection
    .find({ deckTemplateId: { $in: deckTemplateIds } })
    .toArray();
  const templatesById = new Map(templateDocuments.map((document) => [document.deckTemplateId, document.template]));
  const decks = users.flatMap((deckOwner) => {
    const ownerUserId = deckOwner._id.toHexString();
    const templates = deckOwner.decksData
      .map((deckData) => templatesById.get(deckData.deckTemplateId))
      .filter((template): template is DeckTemplateDocument["template"] => Boolean(template));
    const decksData = serverDeckDataItemsToClientDeckDataSteps(deckOwner.decksData);

    return mergeDeckTemplatesWithUserData(templates, decksData, ownerUserId, {
      canMutate: ownerUserId === currentUserId,
      currentUserId,
      ownerUserId,
      ownerUsername: deckOwner.username,
      showOwnerTag: true,
    });
  });

  return {
    decks,
    users,
  };
}

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) {
    return <AuthScreen />;
  }



  const adminDeckData = user.isAdmin ? await getAdminDecks(user.id) : null;
  const serverDeckData = user.decksData;
  const decksData = serverDeckDataItemsToClientDeckDataSteps(serverDeckData);
  const visibleDeckTemplates = user.isAdmin ? [] : await getVisibleDeckTemplatesForUser(user);
  const renderDecks = adminDeckData
    ? adminDeckData.decks
    : mergeDeckTemplatesWithUserData(visibleDeckTemplates, decksData, user.id, {
        currentUserId: user.id,
        ownerUserId: user.id,
        ownerUsername: user.username,
      });

  // Authenticated user identity is handled separately from social users.
  // Social users will come from a dedicated lookup layer, but mock social data
  // can be enabled for design and UI testing.
  const users = adminDeckData
    ? adminDeckData.users.map((deckOwner) => ({
        id: deckOwner._id.toHexString(),
        name: deckOwner.username,
      }))
    : user.username !== 'Michael' //Michael is the only user with mock social data in this mock setup
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
