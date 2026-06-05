"use client";

import Link from "next/link";
import { useState } from "react";

type DeckMenuProps = {
  deckTemplateId: string;
};

export default function DeckMenu({ deckTemplateId }: DeckMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

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
          <Link className="deck-menu-item" href={`/creator/edit/${deckTemplateId}`} role="menuitem">
            Edit
          </Link>
        </div>
      ) : null}
    </div>
  );
}
