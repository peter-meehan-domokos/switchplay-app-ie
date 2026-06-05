import AuthScreen from "@/components/auth/AuthScreen";
import CreatorDragLab from "@/components/creator/CreatorDragLab";
import { getCurrentUser } from "@/lib/auth";

export default async function CreatorPage() {
  const user = await getCurrentUser();

  if (!user) {
    return <AuthScreen />;
  }

  return <CreatorDragLab />;
}
