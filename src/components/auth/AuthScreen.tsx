"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";

export default function AuthScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Unable to sign in.");
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <p className="eyebrow">Switchplay</p>
        <h1>Sign in</h1>
        <p className="auth-copy">Use the seeded developer account to unlock the current app shell.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span>Email</span>
            <input
              autoComplete="email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>

          <label className="auth-field">
            <span>Password</span>
            <input
              autoComplete="current-password"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          {error ? <p className="auth-error">{error}</p> : null}

          <button className="auth-submit" disabled={isPending} type="submit">
            {isPending ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}