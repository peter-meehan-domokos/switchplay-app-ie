import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { resolveInteractiveVisual } from "@/lib/interactiveVisuals/catalogue";
import { visualGuestLoginContext } from "@/lib/visualLearningRecords/guestServer";
import InteractiveVisualEntry from "@/components/interactiveVisuals/InteractiveVisualEntry";

export default async function InteractiveVisualPage({ params, searchParams }: {
  params: Promise<{ activityId: string }>;
  searchParams: Promise<{ claimId?: string | string[] }>;
}) {
  const { activityId } = await params;
  const visual = resolveInteractiveVisual(activityId, { disabledIds: (process.env.SWITCHPLAY_DISABLED_INTERACTIVE_VISUAL_IDS ?? "").split(",").map(id => id.trim()) });
  if (!visual) notFound();
  const { claimId: candidate } = await searchParams;
  const claimId = typeof candidate === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate) ? candidate : undefined;
  const user = await getCurrentUser();
  const context = user ? await visualGuestLoginContext(user.id, claimId) : undefined;
  return <InteractiveVisualEntry key={`${user?.id ?? "guest"}:${activityId}:${claimId ?? ""}`} activityId={activityId} title={visual.title}
    accountId={user?.id} claimId={claimId} guestContext={context} />;
}
