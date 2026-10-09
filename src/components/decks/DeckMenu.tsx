"use client";

import Link from "next/link";
import { useState } from "react";

type DeckMenuProps = {
  deckId: string;
  deckTemplateId: string;
  editHref?: string;
};

export default function DeckMenu({ deckId, deckTemplateId, editHref }: DeckMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const href = editHref ?? `/creator/edit/${encodeURIComponent(deckTemplateId)}?returnTo=deck&returnDeckId=${encodeURIComponent(deckId)}&returnDeckTemplateId=${encodeURIComponent(deckTemplateId)}`;

  return (
    <div className="deck-menu">
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Deck menu"
        className="deck-menu-trigger"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <span aria-hidden="true">•••</span>
      </button>
      {isOpen ? (
        <div className="deck-menu-popover" role="menu">
          <Link className="deck-menu-item" href={href} prefetch={editHref ? false : undefined} role="menuitem">
            Edit
          </Link>
        </div>
      ) : null}
    </div>
  );
}
