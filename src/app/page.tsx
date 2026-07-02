import AuthScreen from "@/components/auth/AuthScreen";
import AppShell from "@/components/layout/AppShell";
import { ObjectId } from "mongodb";
import type { UserDocument } from "@/lib/auth";
import { getCurrentUser } from "@/lib/auth";
import { mergeDeckTemplatesWithUserData } from "@/lib/deckData";
import { normalizeDeckTemplateForRuntime, serverDeckDataItemsToClientDeckDataSteps } from "@/lib/deckApiTransforms";
import {
  DECK_TEMPLATES_COLLECTION,
  type DeckTemplateDocument,
} from "@/lib/deckTemplateDocuments";
import { getVisibleDeckTemplateDocumentsForUser } from "@/lib/deckTemplateQueries";
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
  const templatesById = new Map(
    templateDocuments.map((document) => [document.deckTemplateId, normalizeDeckTemplateForRuntime(document.template)]),
  );
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

async function getVisibleLibraryDecks(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) {
  const visibleTemplateDocuments = await getVisibleDeckTemplateDocumentsForUser(user);
  const ownerUserIds = [
    ...new Set(
      visibleTemplateDocuments
        .map((document) => document.ownerUserId)
        .filter((ownerUserId) => ObjectId.isValid(ownerUserId)),
    ),
  ];
  const usersCollection = await getCollection<UserDocument>(USERS_COLLECTION);
  const owners = ownerUserIds.length
    ? await usersCollection
        .find(
          { _id: { $in: ownerUserIds.map((ownerUserId) => new ObjectId(ownerUserId)) } },
          { projection: { username: 1 } },
        )
        .toArray()
    : [];
  const usernameByOwnerUserId = new Map(owners.map((owner) => [owner._id.toHexString(), owner.username]));
  const decksData = serverDeckDataItemsToClientDeckDataSteps(user.decksData);

  return visibleTemplateDocuments.flatMap((document) => {
    const ownerUsername = usernameByOwnerUserId.get(document.ownerUserId) ?? user.username;

    return mergeDeckTemplatesWithUserData([document.template], decksData, user.id, {
      currentUserId: user.id,
      ownerUserId: document.ownerUserId,
      ownerUsername,
      showOwnerTag: ownerUsername !== user.username,
    });
  });
}

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) {
    return <AuthScreen />;
  }

  const adminDeckData = user.isAdmin ? await getAdminDecks(user.id) : null;
  const renderDecks = adminDeckData
    ? adminDeckData.decks
    : await getVisibleLibraryDecks(user);

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
