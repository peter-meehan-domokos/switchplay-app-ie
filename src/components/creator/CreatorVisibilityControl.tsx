"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Visibility } from "@/lib/cards/model";

export const PUBLIC_PUBLISHING_NOTICE = "Public publishing requires approval. You can continue creating and publishing privately.";

// Advisory only. null (unknown/failed) never blocks: the publication transaction is authoritative.
async function readApproval(): Promise<boolean | null> {
  try {
    const response = await fetch("/api/account/public-publishing", { cache: "no-store" });
    return response.ok ? (await response.json()).allowed === true : null;
  } catch { return null; }
}

function ApprovalNotice({ onClose }: { onClose: () => void }) {
  const ok = useRef<HTMLButtonElement>(null);
  useEffect(() => { ok.current?.focus({ preventScroll: true }); }, []);
  return createPortal(<div className="creator-modal-backdrop"><div className="creator-modal" role="alertdialog" aria-modal="true" aria-label="Public publishing requires approval"
    onKeyDown={(event) => { event.stopPropagation(); if (event.key === "Escape" || event.key === "Tab") { event.preventDefault(); if (event.key === "Escape") onClose(); } }}>
    <p>{PUBLIC_PUBLISHING_NOTICE}</p>
    <div className="creator-modal-actions"><button ref={ok} type="button" className="creator-modal-primary" onClick={onClose}>OK</button></div>
  </div></div>, document.body);
}

export default function CreatorVisibilityControl({ label, value, publishedPublic, disabled, onChange }: {
  label: string;
  value: Visibility;
  publishedPublic: boolean;
  disabled?: boolean;
  onChange: (visibility: Visibility) => void;
}) {
  const [approved, setApproved] = useState<boolean | null>(null);
  const [notice, setNotice] = useState(false);
  const trigger = useRef<HTMLElement | null>(null);
  const refresh = useCallback(() => { void readApproval().then(setApproved); }, []);
  useEffect(() => {
    refresh();
    window.addEventListener("focus", refresh); window.addEventListener("pageshow", refresh);
    return () => { window.removeEventListener("focus", refresh); window.removeEventListener("pageshow", refresh); };
  }, [refresh]);
  const explain = () => { trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setNotice(true); };
  const close = () => { setNotice(false); requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true })); };
  // Re-read at the moment of choosing: a grant or revocation since the last read must not be trusted.
  const choosePublic = async () => {
    const current = await readApproval(); setApproved(current);
    if (current === false) explain(); else onChange("public");
  };
  const title = publishedPublic ? "Public publication is permanent." : "Visibility for the next publication. Saving does not publish.";
  const ariaLabel = `${label} publication visibility`;
  const dialog = notice ? <ApprovalNotice onClose={close} /> : null;

  return <><select className="creator-visibility-control" aria-label={ariaLabel} title={title}
    value={value} disabled={publishedPublic || disabled}
    onChange={(event) => {
      const next = event.currentTarget.value as Visibility;
      if (next === "public" && approved === false) { void choosePublic(); return; }
      onChange(next);
    }}>
    <option value="private">Private</option>
    {/* Stays selectable so a tap can explain; the controlled value reverts to the previous choice. */}
    <option value="public" style={approved === false ? { color: "#8a9099" } : undefined}>{approved === false ? "Public (requires approval)" : "Public"}</option>
  </select>{dialog}</>;
}
