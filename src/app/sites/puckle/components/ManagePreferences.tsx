"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { StoredPreferences } from "../lib/communicationPreferences";
import { CONTACT_EMAIL } from "../siteInfo";
import PreferencesEditor from "./PreferencesEditor";

type Loaded = { token: string; hasMobile: boolean; preferences: Pick<StoredPreferences, "answers" | "channels"> | null };
type View = { kind: "loading" } | { kind: "invalid" } | { kind: "ready"; loaded: Loaded };
const ENDPOINT = "/api/public/puckle/preferences";

/**
 * Preference management for an interested party, with no account. The signed token travels in the URL fragment, so it is never sent
 * to a server as part of a page request, and is removed from the address bar once read.
 */
export default function ManagePreferences() {
  const [view, setView] = useState<View>({ kind: "loading" });
  // Read once and keep: the fragment is cleared from the address bar, and development runs effects twice.
  const tokenRef = useRef<string | null>(null);
  useEffect(() => {
    if (tokenRef.current === null) { tokenRef.current = window.location.hash.slice(1); history.replaceState(null, "", window.location.pathname); }
    const token = tokenRef.current;
    if (!token) { setView({ kind: "invalid" }); return; }
    const controller = new AbortController();
    fetch(ENDPOINT, { method: "POST", cache: "no-store", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "load", token }) })
      .then(async response => ({ ok: response.ok, body: await response.json().catch(() => null) as { hasMobile?: boolean; preferences?: Loaded["preferences"] } | null }))
      .then(({ ok, body }) => setView(ok && body ? { kind: "ready", loaded: { token, hasMobile: !!body.hasMobile, preferences: body.preferences ?? null } } : { kind: "invalid" }))
      .catch(() => { if (!controller.signal.aborted) setView({ kind: "invalid" }); });
    return () => controller.abort();
  }, []);

  if (view.kind === "loading") return <p role="status">Loading your choices…</p>;
  if (view.kind === "invalid") return <p>This link isn&apos;t valid. Open the link from your email again, or email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and we will change your choices for you. <Link href="/">Go to Puckle</Link></p>;
  const { loaded } = view;
  return <PreferencesEditor audience="interest" endpoint={ENDPOINT} extraBody={{ action: "save", token: loaded.token }} hasEmail hasMobile={loaded.hasMobile} idPrefix="manage" initial={loaded.preferences} unsubscribe />;
}
