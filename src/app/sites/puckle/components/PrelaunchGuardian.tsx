"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GuardianForm } from "@/components/onboarding/GuardianForm";
import { guardianRequestBody, initialOnboardingUi, type GuardianLayout } from "@/components/onboarding/onboardingLayout";
import styles from "./Prelaunch.module.css";

/**
 * The existing parental approval request, opened from the pre-launch welcome. Drafts and the in-flight
 * flag are internal to this form and nothing else needs them. Approval state comes back from the server.
 */
export default function PrelaunchGuardian({ actorId, heading, text, openLabel, guardian }: Readonly<{ actorId: string; heading: string; text: string; openLabel: string; guardian: GuardianLayout }>) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(""), [phoneDraft, setPhoneDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  async function send() {
    const email = draft.trim(), phone = phoneDraft.trim();
    if ((!email && !phone) || sending) return;
    setSending(true); setMessage(null);
    try {
      const response = await fetch("/api/account/parental-approval", { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify(guardianRequestBody(actorId, email, phone)) });
      const body = await response.json().catch(() => null) as Record<string, unknown> | null;
      if (response.ok) {
        setDraft(""); setPhoneDraft("");
        setMessage({ text: typeof body?.message === "string" ? body.message : "Request sent.", error: false });
        router.refresh(); // approval status is owned by the server
      } else setMessage({ text: typeof body?.error === "string" ? body.error : "Something went wrong. Please try again.", error: true });
    } catch { setMessage({ text: "We couldn't reach Puckle. Your entry is still here. Please try again.", error: true }); }
    setSending(false);
  }

  return (
    <section aria-labelledby="prelaunch-approval-title" className={styles.approval} data-prelaunch="approval">
      <h2 className={styles.approvalTitle} id="prelaunch-approval-title">{heading}</h2>
      <p className={styles.approvalText}>{text}</p>
      {open ? (
        <div className={styles.approvalPanel}>
          <GuardianForm actions={{ setDraft, setPhoneDraft, send: () => void send() }} guardian={guardian} id="prelaunch-guardian"
            ui={{ ...initialOnboardingUi, draft, phoneDraft, sending }} />
          {message ? <p className={message.error ? styles.panelError : styles.panelNote} role={message.error ? "alert" : "status"}>{message.text}</p> : null}
        </div>
      ) : (
        <button aria-expanded="false" className={styles.approvalOpen} onClick={() => setOpen(true)} type="button">{openLabel}</button>
      )}
    </section>
  );
}
