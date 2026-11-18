"use client";

import { useState } from "react";
import { announceAuthChange } from "@/lib/authSessionEvents";
import styles from "./Prelaunch.module.css";

export default function PrelaunchSignOut({ username }: Readonly<{ username: string }>) {
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  async function signOut() {
    setState("busy");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) return setState("error");
      announceAuthChange();
      window.location.assign("/"); // a clean start without the signed-in session
    } catch { setState("error"); }
  }
  return (
    <div className={styles.account}>
      <span>Signed in as {username}</span>
      <button className={styles.signOut} disabled={state === "busy"} onClick={() => void signOut()} type="button">{state === "busy" ? "Signing out…" : "Sign out"}</button>
      {state === "error" ? <span role="alert">Sign out failed. Please try again.</span> : null}
    </div>
  );
}
