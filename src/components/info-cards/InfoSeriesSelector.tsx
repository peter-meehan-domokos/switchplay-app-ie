"use client";

import { useEffect, useRef, useState } from "react";
import type { CreatorTransport } from "../creator/creatorRequest";
import type { SeriesOption } from "./infoCardEditorController";
import { clientId } from "@/lib/clientId";
import { infoCardError } from "./infoCardErrors";
import styles from "./InfoCardEditor.module.css";

const CREATE = "__create__";
type Choice = { key: string; label: string; series?: SeriesOption };
const labelOf = (item: SeriesOption) => `${item.title} (${item.creatorUsername})`;

// In-page replacement for the native select, used only inside the Personal editor dialog. A native picker is
// operating-system UI: on iPhone it takes focus away from the page while open, and the dialog's focus retention
// (useInfoCardDialog) pulls focus back to Cancel, so the picker never stays usable. This listbox keeps focus
// on its trigger throughout (the select-only combobox pattern) and never leaves the dialog.
function SeriesListbox({ own, others, selected, loading, disabled, invalid, onChoose, onCreate }: {
  own: SeriesOption[]; others: SeriesOption[]; selected: SeriesOption | null; loading: boolean; disabled: boolean; invalid?: boolean;
  onChoose: (series: SeriesOption) => void; onCreate: () => void;
}) {
  const [opened, setOpen] = useState(false), [active, setActive] = useState(0);
  const open = opened && !disabled; // A disabled field cannot stay open.
  const root = useRef<HTMLDivElement>(null);
  const choices: Choice[] = [...[...own, ...others].map((series): Choice => ({ key: series.seriesId, label: labelOf(series), series })),
    { key: CREATE, label: "Create a new series…" }];
  const optionId = (index: number) => `info-series-option-${index}`;
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
  }, [open]);
  useEffect(() => { if (open) document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" }); }, [open, active]);
  const show = () => { setActive(Math.max(0, choices.findIndex(choice => choice.key === selected?.seriesId))); setOpen(true); };
  const choose = (choice: Choice) => {
    setOpen(false);
    if (choice.series) onChoose(choice.series); else onCreate();
    document.getElementById("info-series")?.focus({ preventScroll: true });
  };
  const group = (label: string, items: SeriesOption[], offset: number) => !!items.length && <div role="group" aria-label={label} key={label}>
    <div className={styles.seriesGroupLabel} aria-hidden="true">{label}</div>
    {items.map((item, index) => <div key={item.seriesId} id={optionId(offset + index)} role="option" aria-selected={item.seriesId === selected?.seriesId}
      className={`${styles.seriesOption}${offset + index === active ? ` ${styles.seriesActive}` : ""}`}
      onClick={() => choose(choices[offset + index])}>{labelOf(item)}</div>)}
  </div>;
  return <div ref={root} className={styles.seriesBox}>
    <button type="button" id="info-series" role="combobox" className={styles.seriesTrigger} aria-haspopup="listbox" aria-expanded={open}
      aria-controls="info-series-listbox" aria-activedescendant={open ? optionId(active) : undefined} aria-busy={loading}
      aria-invalid={invalid || undefined} aria-describedby={invalid ? "info-series-error" : undefined} disabled={disabled}
      // Safari does not focus a button when it is tapped; take focus so the arrow keys and Escape reach this control.
      onClick={event => { event.currentTarget.focus({ preventScroll: true }); if (open) setOpen(false); else show(); }}
      onKeyDown={event => {
        if (!open) { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); show(); } return; }
        const move = (to: number) => { event.preventDefault(); setActive(Math.min(choices.length - 1, Math.max(0, to))); };
        if (event.key === "ArrowDown") move(active + 1);
        else if (event.key === "ArrowUp") move(active - 1);
        else if (event.key === "Home") move(0);
        else if (event.key === "End") move(choices.length - 1);
        else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose(choices[active]); }
        // Escape closes only the list; the dialog must not treat it as Cancel.
        else if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); }
        else if (event.key === "Tab") setOpen(false);
      }}>
      <span>{selected ? labelOf(selected) : loading ? "Loading series…" : "Choose a series"}</span>
    </button>
    {open && <div id="info-series-listbox" role="listbox" aria-label="Series" className={styles.seriesList}
      onMouseDown={event => event.preventDefault()}>
      {group("Your series", own, 0)}
      {group("Other creators’ series", others, own.length)}
      <div id={optionId(choices.length - 1)} role="option" aria-selected="false"
        className={`${styles.seriesOption}${active === choices.length - 1 ? ` ${styles.seriesActive}` : ""}`}
        onClick={() => choose(choices[choices.length - 1])}>Create a new series…</div>
    </div>}
  </div>;
}

export default function InfoSeriesSelector({ actor, username, selected, request, onSelect, disabled, invalid, listbox }: {
  actor: string; username: string; selected: SeriesOption | null; request: CreatorTransport;
  onSelect: (series: SeriesOption) => void; disabled: boolean; invalid?: boolean;
  /** Use the in-page listbox instead of the native select (Personal editor dialog only). */ listbox?: boolean;
}) {
  const [items, setItems] = useState<SeriesOption[]>([]);
  const [loading, setLoading] = useState(true), [creating, setCreating] = useState(false), [error, setError] = useState("");
  const [newSeries, setNewSeries] = useState(false), [title, setTitle] = useState("");
  const [retry, setRetry] = useState(0);
  const creation = useRef<{ title: string; id: string } | null>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true); setError("");
      try {
        const rows: SeriesOption[] = []; let offset: number | null = 0;
        do {
          const result: { items: SeriesOption[]; nextOffset: number | null } = await request(`/api/info-card-series?limit=50&offset=${offset}`);
          if (!active) return;
          rows.push(...result.items); offset = result.nextOffset;
        } while (offset !== null);
        setItems(rows);
      } catch (cause) { if (active) setError(infoCardError(cause)); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [request, retry]);
  useEffect(() => { if (newSeries) titleInput.current?.focus(); }, [newSeries]);
  async function create() {
    setCreating(true); setError("");
    const name = title.trim();
    if (creation.current?.title !== name) creation.current = { title: name, id: clientId() };
    try {
      const result = await request<Omit<SeriesOption, "creatorUsername">>("/api/info-card-series", "POST", { seriesId: creation.current!.id, title: name });
      const option = { ...result, creatorUsername: username };
      setItems(old => [...old.filter(item => item.seriesId !== option.seriesId), option]);
      onSelect(option); setNewSeries(false); setTitle("");
      requestAnimationFrame(() => document.getElementById("info-series")?.focus());
    } catch (cause) { setError(infoCardError(cause)); }
    finally { setCreating(false); }
  }
  // Retain the authorised card's selection if public discoverability is lost.
  const rows = [...items.filter(item => item.seriesId !== selected?.seriesId), ...(selected ? [selected] : [])];
  const sort = (a: SeriesOption, b: SeriesOption) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }) || a.seriesId.localeCompare(b.seriesId);
  const own = rows.filter(item => item.createdByUserId === actor).sort(sort);
  const others = rows.filter(item => item.createdByUserId !== actor).sort(sort);
  return <section aria-label="Series selection">
    <label htmlFor="info-series">Series</label>
    {listbox ? <SeriesListbox own={own} others={others} selected={selected} loading={loading} disabled={disabled || creating} invalid={invalid}
      onChoose={onSelect} onCreate={() => setNewSeries(true)} /> : <select id="info-series" value={selected?.seriesId ?? ""} disabled={disabled || creating} aria-busy={loading}
      aria-invalid={invalid || undefined} aria-describedby={invalid ? "info-series-error" : undefined}
      onChange={event => {
        if (event.target.value === "__create__") { setNewSeries(true); return; }
        const item = rows.find(row => row.seriesId === event.target.value); if (item) onSelect(item);
      }}>
      <option value="" disabled>{loading ? "Loading series…" : "Choose a series"}</option>
      {!!own.length && <optgroup label="Your series">{own.map(item => <option key={item.seriesId} value={item.seriesId}>{item.title} ({item.creatorUsername})</option>)}</optgroup>}
      {!!own.length && !!others.length && <option disabled>──────────</option>}
      {!!others.length && <optgroup label="Other creators’ series">{others.map(item => <option key={item.seriesId} value={item.seriesId}>{item.title} ({item.creatorUsername})</option>)}</optgroup>}
      <option value="__create__">Create a new series…</option>
    </select>}
    {invalid && <p id="info-series-error" role="alert">Choose a series.</p>}
    {newSeries && <div>
      <label>New series name<input ref={titleInput} value={title} maxLength={200} disabled={creating || disabled} onChange={event => setTitle(event.target.value)}
        onKeyDown={event => { if (event.key === "Enter" && title.trim()) { event.preventDefault(); void create(); } }} /></label>
      <button type="button" disabled={creating || disabled || !title.trim()} onClick={() => void create()}>{creating ? "Creating…" : "Create series"}</button>
      <button type="button" disabled={creating} onClick={() => { setNewSeries(false); document.getElementById("info-series")?.focus(); }}>Cancel</button>
    </div>}
    {error && <p role="alert">{error} <button type="button" disabled={loading} onClick={() => setRetry(value => value + 1)}>Retry series</button></p>}
  </section>;
}
