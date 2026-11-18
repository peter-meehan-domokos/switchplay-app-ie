import { SettingsLinkProvider } from "@/components/layout/SettingsLink";
import { getCurrentSite } from "@/lib/sites/getCurrentSite";
import EmbeddedAuthScreen from "@/components/auth/EmbeddedAuthScreen";
import ProgressShell from "@/components/progress/ProgressShell";
import { getCurrentUser } from "@/lib/auth";

export default async function ProgressPage() {
  const user = await getCurrentUser();
  if (!user) return <EmbeddedAuthScreen />;
  const settings = (await getCurrentSite()) === "puckle" ? "/settings" : undefined;
  return <SettingsLinkProvider href={settings}><ProgressShell key={user.id} currentUserId={user.id} userName={user.username} /></SettingsLinkProvider>;
}
