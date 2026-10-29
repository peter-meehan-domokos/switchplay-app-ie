"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { PublishedInfo } from "@/lib/infoCards/model";
import type { CreatorTransport } from "./creatorRequest";
import styles from "./InfoCardAttachments.module.css";

function mergePublicationMetadata(current: Record<string, PublishedInfo>, incoming: PublishedInfo[]) {
  // Publication order, not response arrival, determines authoritative content.
  const updates = incoming.filter(info => info.version >= (current[info.infoCardId]?.version ?? 0));
  return { ...current, ...Object.fromEntries(updates.map(info => [info.infoCardId, info])) };
}

export default function InfoCardAttachments({ actor, request, value, onChange, publicOnly }: {
  actor: string; request: CreatorTransport; value: string[]; onChange: (ids: string[]) => void; publicOnly: boolean;
}) {
  const id = useId(), trigger = useRef<HTMLButtonElement>(null), container = useRef<HTMLDivElement>(null), list = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false), [loading, setLoading] = useState(false), [error, setError] = useState("");
  const [items, setItems] = useState<PublishedInfo[]>([]), [labels, setLabels] = useState<Record<string, PublishedInfo>>({});
  const [active, setActive] = useState(0);
  const selectedKey = JSON.stringify(value);
  // Selected identities are modal state, never reconstructed from catalogue pages.
  useEffect(() => {
    let live = true;
    for (const infoId of JSON.parse(selectedKey) as string[]) {
      void request<PublishedInfo>(`/api/info-cards/${encodeURIComponent(infoId)}/publication`).then(info => {
        if (live) setLabels(current => mergePublicationMetadata(current, [info]));
      }).catch(() => { /* Keep the reference even when metadata is unavailable. */ });
    }
    return () => { live = false; };
  }, [selectedKey, actor, request, publicOnly]);
  useEffect(() => {
    if (!open) return;
    let live = true;
    list.current?.focus();
    void (async () => {
      try {
        const all = new Map<string, PublishedInfo>(); let offset: number | null = 0;
        do {
          const page: { items: PublishedInfo[]; nextOffset: number | null } = await request(`/api/library/info-cards?limit=50&offset=${offset}`);
          if (!live) return;
          for (const info of page.items) all.set(info.infoCardId, info);
          offset = page.nextOffset;
        } while (offset !== null);
        const rows = [...all.values()];
        setItems(rows); setLabels(current => mergePublicationMetadata(current, rows));
      } catch { if (live) setError("Unable to load Info Cards. Close and reopen the dropdown to try again."); }
      finally { if (live) setLoading(false); }
    })();
    const outside = (event: PointerEvent) => { if (!container.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => { live = false; document.removeEventListener("pointerdown", outside); };
  }, [open, actor, request]);
  const eligible = items.map(info => labels[info.infoCardId] ?? info)
    .filter(info => info.visibility === "public" || !publicOnly && info.ownerUserId === actor);
  const own = eligible.filter(info => info.ownerUserId === actor), others = eligible.filter(info => info.ownerUserId !== actor);
  const rows = [...own, ...others];
  const activeIndex = Math.min(active, Math.max(0, rows.length - 1));
  const privateTitles = publicOnly ? value.flatMap(infoId => {
    const info = labels[infoId];
    return info?.visibility === "private" && info.ownerUserId === actor ? [info.content.title] : [];
  }) : [];
  function openDropdown() { setLoading(true); setError(""); setActive(0); setOpen(true); }
  function close() { setOpen(false); trigger.current?.focus(); }
  function select(info: PublishedInfo) {
    if (info.visibility !== "public" && (publicOnly || info.ownerUserId !== actor)) return;
    if (!value.includes(info.infoCardId)) onChange([...value, info.infoCardId]);
    close();
  }
  function keydown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
    else if (event.key === "Tab") setOpen(false);
    else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? rows.length - 1
        : (activeIndex + (event.key === "ArrowDown" ? 1 : -1) + rows.length) % Math.max(1, rows.length);
      setActive(Math.max(0, next));
      document.getElementById(`${id}-option-${next}`)?.scrollIntoView({ block: "nearest" });
    } else if ((event.key === "Enter" || event.key === " ") && !loading && rows[activeIndex]) {
      event.preventDefault(); select(rows[activeIndex]);
    }
  }
  function move(index: number, direction: number) {
    const next = [...value]; [next[index], next[index + direction]] = [next[index + direction], next[index]];
    onChange(next);
  }
  function group(label: string, groupItems: PublishedInfo[], start: number) {
    return <div role="group" aria-label={label}>
      <div className={styles.group}>{label}</div>
      {groupItems.map((info, index) => <div key={info.infoCardId} role="option" id={`${id}-option-${start + index}`}
        aria-selected={value.includes(info.infoCardId)} aria-disabled={value.includes(info.infoCardId)}
        data-active={activeIndex === start + index} className={styles.option}
        onPointerMove={() => setActive(start + index)} onClick={() => select(info)}>
        <span className={styles.title}>{info.content.title}</span>
        <span className={styles.metadata}>{info.series.title}{info.ownerUserId !== actor ? ` · by ${info.creatorUsername}` : ""}</span>
      </div>)}
    </div>;
  }
  return <section className={styles.attachments} aria-labelledby={`${id}-label`}>
    <div id={`${id}-label`} className={styles.label}>Info Cards</div>
    <div ref={container} className={styles.dropdown} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }}>
      <button type="button" ref={trigger} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? `${id}-list` : undefined}
        className={styles.trigger} onClick={() => { if (open) setOpen(false); else openDropdown(); }}
        onKeyDown={event => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); if (!open) openDropdown(); } }}>
        <span>Add Info Card</span>
        <svg className={styles.chevron} width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="m3 5.5 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && <div className={styles.popover}>
        <div ref={list} role="listbox" id={`${id}-list`} tabIndex={0} aria-label="Published Info Cards" aria-multiselectable="true" aria-busy={loading}
          aria-activedescendant={!loading && rows[activeIndex] ? `${id}-option-${activeIndex}` : undefined} onKeyDown={keydown} className={styles.list}>
          {loading ? <div className={styles.message}>Loading Info Cards…</div> : <>
            {group("My Cards", own, 0)}
            <div className={styles.divider} />
            {group("Other Cards", others, own.length)}
          </>}
        </div>
        {error && <p role="alert" className={styles.message}>{error}</p>}
      </div>}
    </div>
    {!!value.length && <ol className={styles.selected} aria-label="Attached Info Cards">
      {value.map((infoId, index) => {
        const candidate = labels[infoId], info = candidate && (candidate.visibility === "public" || candidate.ownerUserId === actor) ? candidate : undefined;
        const title = info?.content.title ?? "Unavailable Info Card";
        return <li key={infoId}>
          <span className={styles.selectionLabel}><span className={styles.title}>{title}</span>
            {info && <span className={styles.metadata}>{info.series.title}{info.ownerUserId !== actor ? ` · by ${info.creatorUsername}` : ""}</span>}</span>
          <div className={styles.controls}>
            <button type="button" aria-label={`Move ${title} up`} disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
            <button type="button" aria-label={`Move ${title} down`} disabled={index === value.length - 1} onClick={() => move(index, 1)}>↓</button>
            <button type="button" aria-label={`Remove attachment ${title}`} onClick={() => onChange(value.filter(id => id !== infoId))}>Remove</button>
          </div>
        </li>;
      })}
    </ol>}
    {!!privateTitles.length && <p className="creator-modal-error" role="status">
      {privateTitles.length === 1
        ? `This Card has a private Info Card attached: ${privateTitles[0]}. Remove it or publish the Info Card publicly before publishing this Card publicly.`
        : `This Card has private Info Cards attached: ${privateTitles.join(", ")}. Remove them or publish those Info Cards publicly before publishing this Card publicly.`}
    </p>}
  </section>;
}
