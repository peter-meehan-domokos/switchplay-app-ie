import type { Metadata } from "next";
import ContactSupportForm from "../components/ContactSupportForm";
import PublicHeader from "../components/PublicHeader";
import PublicLayout from "../components/PublicLayout";
import { SITE_NAME, SUPPORT_EMAIL } from "../siteInfo";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Contact and support",
  description: `Contact ${SITE_NAME} for support, partnerships, press enquiries and general questions.`,
};

export default function ContactPage() {
  return (
    <PublicLayout>
      <PublicHeader showJoinLink={false} />
      <section className={styles.contactPage} aria-labelledby="contact-title">
        <header className={styles.header}>
          <h1 id="contact-title">Contact and support</h1>
          <p>Have a question, need help or want to work with us? We&apos;d love to hear from you.</p>
          <p className={styles.contactNote}>
            Prefer email? Contact us directly at{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          </p>
        </header>
        <div className={styles.formWrap}>
          <ContactSupportForm />
        </div>
      </section>
    </PublicLayout>
  );
}
