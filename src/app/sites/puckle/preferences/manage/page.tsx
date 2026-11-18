import type { Metadata } from "next";
import ManagePreferences from "../../components/ManagePreferences";
import PublicHeader from "../../components/PublicHeader";
import PublicLayout from "../../components/PublicLayout";
import styles from "../../settings/page.module.css";

export const metadata: Metadata = { title: "Communication preferences", robots: { index: false, follow: false } };

export default function ManagePreferencesPage() {
  return (
    <PublicLayout>
      <PublicHeader showJoinLink={false} />
      <section aria-labelledby="manage-title" className={styles.page}>
        <h1 className={styles.longTitle} id="manage-title">Communication Preferences</h1>
        <p className={styles.intro}>Change which optional messages Puckle may send you, or unsubscribe. You do not need an account.</p>
        <ManagePreferences />
      </section>
    </PublicLayout>
  );
}
