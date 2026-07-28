"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";

type AuthScreenProps = {
  redirectTo?: string;
};

export default function AuthScreen({ redirectTo }: AuthScreenProps) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
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
      body: JSON.stringify({ identifier, password }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Unable to sign in.");
      return;
    }

    startTransition(() => {
      if (redirectTo) {
        router.replace(redirectTo);
        return;
      }

      router.refresh();
    });
  }

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <p className="eyebrow">Switchplay</p>
        <h1>Sign in</h1>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span>Username or email</span>
            <input
              autoComplete="username"
              name="identifier"
              onChange={(event) => setIdentifier(event.target.value)}
              required
              type="text"
              value={identifier}
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
