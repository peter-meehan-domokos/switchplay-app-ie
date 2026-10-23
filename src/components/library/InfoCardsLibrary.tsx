"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import OverviewMenu from "../layout/OverviewMenu";
import InfoCardFace from "../info-cards/InfoCardFace";
import { actorCreatorTransport, CreatorRequestError, CreatorActorLifetime } from "../creator/creatorRequest";
import { infoCardError } from "../info-cards/infoCardErrors";
import type { PublishedInfo } from "@/lib/infoCards/model";
import LibraryTabs from "./LibraryTabs";
import styles from "./InfoCardsLibrary.module.css";
import InfoCardRemoteMediaViewer from "../info-cards/InfoCardRemoteMediaViewer";

type Page = { items: PublishedInfo[]; nextOffset: number | null };
export default function InfoCardsLibrary({ actor, username }: { actor: string; username: string }) {
  const active = useRef(true), sequence = useRef(0);
  const [lifetime] = useState(() => new CreatorActorLifetime());
  const [request] = useState(() => actorCreatorTransport(actor, () => lifetime.isActive()));
  const [items, setItems] = useState<PublishedInfo[]>([]), [next, setNext] = useState<number | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [mediaCard, setMediaCard] = useState<PublishedInfo | null>(null);
  const read = useCallback(async (offset = 0) => {
    const token = ++sequence.current; setLoading(true); setError("");
    try {
      const page = await request<Page>(`/api/library/info-cards?${new URLSearchParams({ offset: String(offset), limit: "30" })}`);
      if (token !== sequence.current || !active.current) return;
      setItems(old => offset === 0 ? page.items : [...old, ...page.items.filter(item => !old.some(prior => prior.infoCardId === item.infoCardId))]); setNext(page.nextOffset);
    } catch (cause) {
      if (token !== sequence.current || !active.current) return;
      if (offset === 0 || cause instanceof CreatorRequestError && (cause.status === 401 || cause.code.includes("SESSION"))) { setItems([]); setNext(null); setMediaCard(null); }
      setError(infoCardError(cause));
    } finally { if (token === sequence.current && active.current) setLoading(false); }
  }, [request]);
  useEffect(() => {
    active.current = true; lifetime.setActive(true); void Promise.resolve().then(() => { if (active.current) void read(); });
    const refresh = () => { if (document.visibilityState !== "hidden") void read(); };
    window.addEventListener("focus", refresh); window.addEventListener("pageshow", refresh);
    return () => { active.current = false; lifetime.setActive(false); window.removeEventListener("focus", refresh); window.removeEventListener("pageshow", refresh); };
  }, [read, lifetime]);
  return <main className="app-shell library-shell">
    <OverviewMenu username={username} userId={actor} />
    <header className="overview-header"><p className="eyebrow">{username}</p><h1>Library</h1></header>
    <LibraryTabs active="info-cards" />
    {error && <p role="alert">{error} <button type="button" onClick={() => void read()}>Retry Library</button></p>}
    {loading && <p role="status">Loading Info Cards…</p>}
    {!loading && !error && !items.length && <p>No published Info Cards found.</p>}
    <div className={styles.grid}>{items.map(card => <div key={card.infoCardId} className={styles.item} data-info-id={card.infoCardId}>
        <p className={styles.series}>{card.series.title} (series by {card.series.creatorUsername})</p>
        <InfoCardFace card={{ title: card.content.title, body: card.content.body, seriesTitle: card.series.title, seriesCreatorUsername: card.series.creatorUsername, mediaKind: card.content.mediaItem?.mediaType }}
          onOpenMedia={card.content.mediaItem ? () => setMediaCard(card) : undefined} />
        <p className={styles.attribution}>Card by {card.creatorUsername}</p>
        <div className={styles.metadata}>{card.visibility === "private" && <span>Private</span>}
          {card.ownerUserId === actor && <Link aria-label={`Edit ${card.content.title}`} href={`/creator/info-cards/${encodeURIComponent(card.infoCardId)}`}>Edit</Link>}</div>
      </div>)}</div>
    
    {next !== null && <button type="button" disabled={loading} onClick={() => void read(next)}>More Info Cards</button>}
    {mediaCard?.content.mediaItem && <InfoCardRemoteMediaViewer actor={actor} media={mediaCard.content.mediaItem}
      context={{ infoCardId: mediaCard.infoCardId, kind: "publication", version: mediaCard.version }} onClose={() => setMediaCard(null)} />}
  </main>;
}
