"use client";

import { workingCardStore } from "@/lib/cards/workingCardStore";
import { flushPersonalMutations } from "@/lib/deckMutations";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type OverviewMenuProps = { username: string; userId: string };
export default function OverviewMenu({ username, userId }: OverviewMenuProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleLogout() {
    await flushPersonalMutations();
    const response = await fetch("/api/auth/logout", {
      method: "POST",
    });

    if (!response.ok) {
      return;
    }

    workingCardStore.clearUser(userId);
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
          <Link className="deck-menu-item" href="/creator/new" role="menuitem" onClick={() => setIsOpen(false)}>
            Create
          </Link>
          <div className="overview-menu-divider" role="separator" aria-orientation="horizontal" />
          <Link className="deck-menu-item" href="/contact" role="menuitem" onClick={() => setIsOpen(false)}>
            Support
          </Link>
          <Link className="deck-menu-item" href="/" role="menuitem" onClick={() => setIsOpen(false)}>
            Website
          </Link>
          <button
            className="deck-menu-item overview-menu-item-button"
            disabled={isPending}
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              void handleLogout();
            }}
            type="button"
          >
            {isPending ? "Signing out..." : "Sign out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
