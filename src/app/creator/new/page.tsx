import EmbeddedAuthScreen from "@/components/auth/EmbeddedAuthScreen";
import CreatorDragLab from "@/components/creator/CreatorDragLab";
import { blankPrivateBoard } from "@/components/creator/cardArchitectureAdapter";
import { getCurrentUser } from "@/lib/auth";
import { stepMediaAuthoringEnabled } from "@/lib/stepMediaRollout";
import { creatorNavigation, type CreatorSearch } from "@/components/creator/creatorNavigation";

export default async function NewCreatorPage({ searchParams }: { searchParams: Promise<CreatorSearch> }) {
  const user = await getCurrentUser();

  if (!user) {
    return <EmbeddedAuthScreen />;
  }

  const canPreviewOutput = user.isAdmin === true || user.username === "dev";

  return (
    <CreatorDragLab
      canPreviewOutput={canPreviewOutput}
      multimediaEnabled={stepMediaAuthoringEnabled()}
      currentUserId={user.id}
      initialBoard={blankPrivateBoard()}
      mode="new"
      navigation={creatorNavigation(await searchParams, true)}
    />
  );
}
