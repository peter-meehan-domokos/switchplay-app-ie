"use client";

import { useEffect, useRef, useState } from "react";
import type { CreatorTransport } from "../creator/creatorRequest";
import type { SeriesOption } from "./infoCardEditorController";
import { clientId } from "@/lib/clientId";
import { infoCardError } from "./infoCardErrors";

export default function InfoSeriesSelector({ actor, username, selected, request, onSelect, disabled, invalid }: {
  actor: string; username: string; selected: SeriesOption | null; request: CreatorTransport;
  onSelect: (series: SeriesOption) => void; disabled: boolean; invalid?: boolean;
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
    <select id="info-series" value={selected?.seriesId ?? ""} disabled={disabled || creating} aria-busy={loading}
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
    </select>
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
