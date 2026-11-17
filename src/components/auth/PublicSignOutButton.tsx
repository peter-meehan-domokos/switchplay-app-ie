"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { announceAuthChange } from "@/lib/authSessionEvents";

/**
 * Sign out for the public website navigation. Same request and follow-up as the application's LogoutButton
 * (POST /api/auth/logout, announce the change, refresh), so the server-rendered menu returns to its signed-out state.
 */
export default function PublicSignOutButton({ className, onDone }: Readonly<{ className?: string; onDone?: () => void }>) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function signOut() {
    setBusy(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (response.ok) { announceAuthChange(); onDone?.(); router.refresh(); }
    } catch { /* stay signed in; the button becomes available again */ }
    setBusy(false);
  }
  // Reset only what a button adds; the site's own link class supplies size, colour and spacing.
  return <button className={className} disabled={busy} onClick={() => void signOut()} style={{ background: "none", border: 0, cursor: "pointer", fontFamily: "inherit", appearance: "none" }} type="button">{busy ? "Signing out…" : "Sign out"}</button>;
}
