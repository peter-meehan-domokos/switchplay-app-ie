import EmbeddedAuthScreen from "@/components/auth/EmbeddedAuthScreen";
import ProgressShell from "@/components/progress/ProgressShell";
import { getCurrentUser } from "@/lib/auth";

export default async function ProgressPage() {
  const user = await getCurrentUser();
  if (!user) return <EmbeddedAuthScreen />;
  return <ProgressShell key={user.id} currentUserId={user.id} userName={user.username} />;
}
