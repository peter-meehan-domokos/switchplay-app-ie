import type { Metadata } from "next";
import PublicHeader from "@/components/public-site/PublicHeader";
import PublicLayout from "@/components/public-site/PublicLayout";
import { SUPPORT_EMAIL } from "@/components/support/SupportErrorMessage";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Switchplay collects, stores and uses information submitted through public forms.",
};

export default function PrivacyPage() {
  return (
    <PublicLayout>
      <PublicHeader showJoinLink={false} />
      <article className={styles.privacyPage} aria-labelledby="privacy-title">
        <header className={styles.header}>
          <h1 id="privacy-title">Privacy Policy</h1>
          <p>
            This page explains how Switchplay uses the personal information you choose to send through our public
            website forms.
          </p>
        </header>

        <section className={styles.section}>
          <h2>Information we collect</h2>
          <p>
            We may collect your name, email address, mobile phone number, country calling code, age, location, message
            content, creator interest details, early access goals, and any extra information you include in a form.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Forms that collect information</h2>
          <p>
            This information may be collected through the Contact and support form, the Creator Interest form, and the
            Early Access form.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Why we collect it</h2>
          <p>
            We use submitted information to respond to your message, manage support or issue reports, review creator
            interest, manage early access requests, and understand whether there may be a relevant partnership,
            press, media, or organisation enquiry.
          </p>
        </section>

        <section className={styles.section}>
          <h2>How it is stored and used</h2>
          <p>
            Form submissions are stored in Switchplay systems so the team can review them and respond where appropriate.
            We use the details you provide only for purposes connected with your enquiry or request.
          </p>
        </section>

        <section className={styles.section}>
          <h2>How long we keep it</h2>
          <p>
            We may retain form submissions for as long as needed to handle your enquiry, keep a useful record of the
            conversation, manage early access or creator interest, and meet reasonable business or legal requirements.
            Retention periods may vary depending on the nature of the request.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Service providers</h2>
          <p>
            We may use service providers to host the website, store form submissions, operate databases, provide
            infrastructure, or support communications. These providers may process information for Switchplay when
            providing those services.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Your rights</h2>
          <p>
            Depending on where you live, you may have rights to request access to your personal information, ask for it
            to be corrected or deleted, object to or restrict certain uses, or ask for a copy of information you have
            provided. Some rights may be limited by practical or legal requirements.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Contact us</h2>
          <p>
            To ask about privacy or your information, contact Switchplay at{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          </p>
        </section>
      </article>
    </PublicLayout>
  );
}
