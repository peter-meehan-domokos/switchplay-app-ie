import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import EmbeddedAuthScreen from "@/components/auth/EmbeddedAuthScreen";
import { getCurrentUser } from "@/lib/auth";
import { getDatabase } from "@/lib/mongodb";
import { approvalSummary } from "@/lib/parentalApproval";
import { prelaunchAccessFor } from "@/lib/prelaunch";
import type { PuckleMembership } from "@/lib/puckleMemberships";
import PrelaunchWelcome from "../components/PrelaunchWelcome";
import { buildPrelaunchLayout } from "../lib/prelaunchLayout";

export const metadata: Metadata = { title: "Welcome", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Served by the proxy in place of My Decks, Library, Progress and Creator for a signed-in Puckle member who
 * is not on the pre-launch access list. It never reads or records the original welcome.
 */
export default async function PrelaunchPage() {
  const user = await getCurrentUser();
  if (!user) return <EmbeddedAuthScreen />;
  // Exempt accounts and normal mode never reach this page through the proxy; direct requests cannot see it either.
  if (prelaunchAccessFor({ site: "puckle", email: user.email }) !== "prelaunch") notFound();
  const db = await getDatabase(), userId = new ObjectId(user.id);
  const [membership, approval] = await Promise.all([
    db.collection<PuckleMembership>("puckleMemberships").findOne({ userId }, { projection: { registrationCategory: 1 } }),
    approvalSummary(db, userId),
  ]);
  return <PrelaunchWelcome actorId={user.id} layout={buildPrelaunchLayout({ category: membership?.registrationCategory, approval })} username={user.username} />;
}
