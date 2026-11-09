"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import SupportErrorMessage from "@/components/support/SupportErrorMessage";
import { siteBrands } from "@/lib/sites/siteBrands";
import type { SiteId } from "@/lib/sites/siteResolver";

type AuthScreenProps = {
  redirectTo?: string;
  site?: SiteId;
};

export default function AuthScreen({ redirectTo, site = "switchplay" }: AuthScreenProps) {
  const brand = siteBrands[site];
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
      setError("support");
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
    <section className="auth-screen" aria-labelledby="auth-title">
      <section className="auth-card">
        <p className="eyebrow">{brand.name}</p>
        <h1 id="auth-title">Sign in</h1>
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

          {error ? <SupportErrorMessage className="auth-error" email={brand.supportEmail} /> : null}

          <button className="auth-submit" disabled={isPending} type="submit">
            {isPending ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </section>
  );
}
