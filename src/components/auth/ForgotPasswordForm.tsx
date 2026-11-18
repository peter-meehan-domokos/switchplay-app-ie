"use client";
import { useState, type FormEvent } from "react";
import styles from "./AccountRecovery.module.css";
export default function ForgotPasswordForm() {
  const [email, setEmail] = useState(""), [message, setMessage] = useState(""), [pending, setPending] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setPending(true); setMessage("");
    try {
      const response = await fetch("/api/auth/password-reset/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const data = await response.json(); setMessage(response.ok ? data.message : data.error);
    } catch { setMessage("Unable to send this request. Please try again later."); }
    finally { setPending(false); }
  }
  return <main className={styles.panel}><h1>Forgot password?</h1><p>Enter your account email to request a reset link.</p><form onSubmit={submit}><label>Email<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></label><button disabled={pending}>{pending ? "Requesting…" : "Request reset link"}</button></form><p role="status">{message}</p><a href="/login">Back to sign in</a></main>;
}
