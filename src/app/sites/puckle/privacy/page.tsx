import type { Metadata } from "next";
import Link from "next/link";import PublicHeader from "../components/PublicHeader";
import PublicLayout from "../components/PublicLayout";
import { SITE_NAME, CONTACT_EMAIL } from "../siteInfo";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${SITE_NAME} collects, stores and uses information submitted through public forms.`,
};

export default function PrivacyPage() {
  return (
    <PublicLayout>
      <PublicHeader showJoinLink={false} />
      <article className={styles.privacyPage} aria-labelledby="privacy-title">
        <header className={styles.header}>
          <h1 id="privacy-title">Privacy Policy</h1>
          <p>
            This page explains how {SITE_NAME} uses the personal information you choose to send through our public
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
          <h2>Joining {SITE_NAME}</h2>
          <p>
            If you join as a student or teacher, we collect your name, a username, your email address and a password
            (stored only as a one-way hash). We email you a code to confirm the address before your account is created.
            Students also give their date of birth, which we use to confirm the minimum age of 13, and their maths course
            and level. We hold one date of birth and one approval record for your account. A mobile number is optional and is not used to sign in. Teachers may add a short introduction.
          </p>
          <p>
            If you tell us you do not have an email address, we save a contact request with your name, mobile number and
            the details you entered, and contact you personally. No account is created from that request. If you ask to
            be kept updated, we save your name, email and/or mobile number and anything you tell us about your interest,
            separately from accounts.
          </p>
          <h3>Communication choices</h3>
          <p>
            When you join as a student or teacher, we ask you to answer Yes or No to two optional communications: Puckle
            Updates (content, guided activities or collaboration opportunities, news and occasional offers) and
            Occasional personal contact (we may get in touch to offer help or ask for feedback). Saying Yes to Puckle
            Updates covers new content, news and offers, and invitations, which you can then change one by one in
            Settings. If you only register your interest, you answer for updates, news and offers, and personal contact
            separately. If you say Yes to updates, offers or invitations, you also choose whether we send them by email,
            text message or both. We record your answers with the date and the wording you saw, and only send optional
            messages you have said Yes to, by the channels you chose. Answering No is fine and does not affect joining.
            Saying Yes to one choice is not permission for another. People who joined before these choices existed have
            not been asked, and we treat that as no.
          </p>
          <p>
            Whatever you choose, we still send the messages needed to run your account (such as verification codes,
            password resets, parent or guardian approval emails and important service notices) and we reply to
            questions and support requests you send us. You can change or withdraw your choices at any time: in Settings
            if you have an account, through the link we give you if you signed up with an email address and no account, or by
            texting us on the numbers on our <Link href="/contact">contact page</Link> if you gave only a mobile number.
            You can also email {CONTACT_EMAIL}.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Parent or guardian approval</h2>
          <p>
            Students under 16 need a parent or guardian&apos;s approval before taking part in Group Learning. If a
            student gives us a parent or guardian&apos;s email address, we email that person a link to read what is
            involved and approve or decline. We record their email address, their decision, the statement they confirmed,
            the version of the explanation they read and when. This is not a check of anyone&apos;s identity or age. One
            approval covers Group Learning on Puckle.
            It is not permission for live tuition. The parent or guardian can withdraw it at any time; withdrawing does not
            delete the student&apos;s learning.
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
            Form submissions are stored in {SITE_NAME} systems so the team can review them and respond where appropriate.
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
            infrastructure, or support communications. These providers may process information for {SITE_NAME} when
            providing those services.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Website analytics</h2>
          <p>
            {SITE_NAME} uses Vercel Analytics to understand general website usage, such as which pages are visited. We
            use this information to improve the website. We do not intentionally send names, email addresses, phone
            numbers or form contents to analytics.
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
            To ask about privacy or your information, contact {SITE_NAME} at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>
        </section>
      </article>
    </PublicLayout>
  );
}
