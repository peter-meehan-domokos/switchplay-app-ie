"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type LogoutButtonProps = {
  username: string;
};

export default function LogoutButton({ username }: LogoutButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleLogout() {
    setError(null);

    const response = await fetch("/api/auth/logout", {
      method: "POST",
    });

    if (!response.ok) {
      setError("Logout failed.");
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="session-actions">
      <span className="session-chip">{username}</span>
      <button className="session-logout" disabled={isPending} onClick={handleLogout} type="button">
        {isPending ? "Signing out..." : "sign out"}
      </button>
      {error ? <p className="session-error">{error}</p> : null}
    </div>
  );
}