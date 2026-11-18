import type { Metadata } from "next";
import ContactPanel from "../components/ContactPanel";
import ContactSupportForm from "../components/ContactSupportForm";
import PublicHeader from "../components/PublicHeader";
import PublicLayout from "../components/PublicLayout";
import { SITE_NAME } from "../siteInfo";
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
        </header>
        <ContactPanel />
        <div className={styles.formWrap}>
          <h2 className={styles.formHeading}>Or send us a message</h2>
          <ContactSupportForm />
        </div>
      </section>
    </PublicLayout>
  );
}
