"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type OverviewMenuProps = {
  username: string;
  currentViewMode: "mine" | "shared";
  isLoadingSharedDecks: boolean;
  onSelectMyDecks: () => void;
  onSelectSharedWithMe: () => void;
};

export default function OverviewMenu({
  username,
  currentViewMode,
  isLoadingSharedDecks,
  onSelectMyDecks,
  onSelectSharedWithMe,
}: OverviewMenuProps) {
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
          <button
            className="deck-menu-item overview-menu-item-button"
            disabled={isLoadingSharedDecks}
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              if (currentViewMode === "shared") {
                onSelectMyDecks();
                return;
              }

              onSelectSharedWithMe();
            }}
            type="button"
          >
            {currentViewMode === "shared" ? "My decks" : isLoadingSharedDecks ? "Loading shared decks..." : "Shared with me"}
          </button>
          <Link className="deck-menu-item" href="/creator/new" role="menuitem" onClick={() => setIsOpen(false)}>
            Create
          </Link>
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
