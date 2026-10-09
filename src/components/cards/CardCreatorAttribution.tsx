"use client";
import { useState } from "react";
import type { PresentedCard } from "@/components/decks/presentation";
export default function CardCreatorAttribution({ card }: { card: PresentedCard }) {
  const [open, setOpen] = useState(false);
  const creator = card.creator;
  const name = creator?.username || "Unknown creator";
  return <div className="card-creator-attribution" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => { event.stopPropagation(); if (event.key === "Escape") setOpen(false); }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    {creator?.immediateSourceUsername ? <button className="card-creator-name" title={name} type="button" aria-expanded={open} aria-label={`Card creator ${name}; show source creator`} onClick={() => setOpen((value) => !value)}>{name}</button> : <span className="card-creator-name" title={name}>{name}</span>}
    {open && creator?.immediateSourceUsername && <span className="card-source-attribution" role="status">Source: {creator.immediateSourceUsername}</span>}
  </div>;
}
