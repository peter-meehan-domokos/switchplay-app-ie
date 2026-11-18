import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ObjectId } from "mongodb";
import { getCurrentUser } from "@/lib/auth";
import { getDatabase } from "@/lib/mongodb";
import { loadMemberPreferences } from "@/lib/puckleCommunicationPreferences";
import PreferencesEditor from "../components/PreferencesEditor";
import PublicHeader from "../components/PublicHeader";
import PublicLayout from "../components/PublicLayout";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

/** Account settings. Each setting is its own section; today there is just Communication Preferences. */
export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?returnTo=/settings");
  const state = await loadMemberPreferences(await getDatabase(), new ObjectId(user.id));
  return (
    <PublicLayout>
      <PublicHeader showJoinLink={false} />
      <section aria-labelledby="settings-title" className={styles.page}>
        <h1 id="settings-title">Settings</h1>
        <div className={styles.setting}>
          <h2 className={styles.settingTitle}>Communication preferences</h2>
          {state ? (
            <>
              <p className={styles.intro}>Choose which optional messages Puckle may send you. We always send the messages needed to run your account, and we reply to anything you ask us.</p>
              <PreferencesEditor audience={state.audience} endpoint="/api/account/communication-preferences" hasEmail hasMobile={state.hasMobile} idPrefix="settings" initial={state.stored} variant="settings" />
            </>
          ) : (
            <p className={styles.intro}>Communication preferences are available to Puckle students and teachers.</p>
          )}
        </div>
      </section>
    </PublicLayout>
  );
}
