import EmbeddedAuthScreen from "@/components/auth/EmbeddedAuthScreen";
import CreatorDragLab from "@/components/creator/CreatorDragLab";
import { createBlankCreatorBoard } from "@/components/creator/creatorBoardState";
import { getCurrentUser } from "@/lib/auth";

export default async function NewCreatorPage() {
  const user = await getCurrentUser();

  if (!user) {
    return <EmbeddedAuthScreen />;
  }

  const canPreviewOutput = user.isAdmin === true || user.username === "dev";

  return (
    <CreatorDragLab
      canPreviewOutput={canPreviewOutput}
      initialBoard={createBlankCreatorBoard()}
      mode="new"
    />
  );
}
