"use client";

import { useEffect, useRef } from "react";
import type { PublicPublicationReview } from "./creatorPersistenceCoordinator";

export default function CreatorPublicConfirmation({ review, onConfirm, onCancel }: {
  review: PublicPublicationReview;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const modal = useRef<HTMLDivElement>(null);
  useEffect(() => { modal.current?.querySelector<HTMLButtonElement>("button")?.focus(); }, []);
  const cards = review.cards.length, decks = review.deck ? 1 : 0;
  const count = `${cards} ${cards === 1 ? "Card" : "Cards"} and ${decks} ${decks === 1 ? "Deck" : "Decks"}`;
  return <div className="creator-modal-backdrop">
    <div className="creator-modal" ref={modal} role="dialog" aria-modal="true" aria-label="Confirm public publication"
      onKeyDown={(event) => {
        if (event.key === "Escape") { event.stopPropagation(); onCancel(); }
        if (event.key === "Tab") {
          const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
          const first = buttons[0], last = buttons.at(-1);
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
      <p>You are about to make {count} public.</p>
      <p>Public content is available to other users and cannot be made private again.</p>
      <div className="creator-modal-actions">
        <button className="creator-modal-secondary" type="button" onClick={onCancel}>Cancel</button>
        <button className="creator-modal-primary" type="button" onClick={onConfirm}>Publish publicly</button>
      </div>
    </div>
  </div>;
}
