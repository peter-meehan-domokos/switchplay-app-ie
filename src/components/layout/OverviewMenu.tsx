"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type OverviewMenuProps = {
  username: string;
};

export default function OverviewMenu({ username }: OverviewMenuProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleLogout() {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
    });

    if (!response.ok) {
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="overview-menu">
      <span className="session-chip">{username}</span>
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Overview menu"
        className="deck-menu-trigger"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <span aria-hidden="true">•••</span>
      </button>
      {isOpen ? (
        <div className="deck-menu-popover" role="menu">
          <Link className="deck-menu-item" href="/creator/new" role="menuitem">
            Create
          </Link>
          <button
            className="deck-menu-item overview-menu-item-button"
            disabled={isPending}
            onClick={handleLogout}
            type="button"
          >
            {isPending ? "Signing out..." : "Sign out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}