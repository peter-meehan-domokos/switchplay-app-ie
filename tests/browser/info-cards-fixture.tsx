import { createRoot } from "react-dom/client";
import { useEffect, useRef, useState } from "react";
import FocusedCardView from "@/components/decks/FocusedCardView";
import type { CanonicalCardPresentation } from "@/components/decks/presentation";
import InfoCardFace, { type InfoCardFaceContent } from "@/components/info-cards/InfoCardFace";
import "@/app/globals.css";
import styles from "./info-cards-fixture.module.css";

const maths: InfoCardFaceContent = {
  seriesTitle: "What You Need",
  seriesCreatorUsername: "peter",
  title: "Negative signs",
  body: "When you rearrange an expression, keep every minus sign attached to its number. Use brackets to keep the signs clear.\n\nTwo negatives multiply to make a positive. One negative gives a negative.",
  mediaKind: "video",
};
const samples: Record<string, InfoCardFaceContent> = {
  maths,
  basketball: {
    seriesTitle: "What To Do", seriesCreatorUsername: "coach", title: "Create space",
    body: "Step away from your defender before you cut towards the basket.\n\nChange speed as you turn. Keep your eyes up so you can see the pass.", mediaKind: "image",
  },
  "tall-lines": {
    ...maths, title: "Inverse input",
    body: "x = (a + b) / c\n\ny = (x − 1) / 2\n\nf(x) = (x + 3) / (x − 2)",
  },
  "long-header": { ...maths, seriesTitle: "Understanding inverse function notation", title: "Recognising the original input" },
  "over-capacity": { ...maths, body: Array(5).fill(maths.body).join("\n\n") },
};
const mainCard: CanonicalCardPresentation = {
  surface: "canonical", id: "info-cards-fixture", cardTemplateId: "info-cards-fixture", version: 1,
  label: "Practice", creator: { username: "Fixture", immediateSourceUsername: null },
  intro: { title: "Start To Master It", description: "A static layout fixture. No video is loaded.", mediaItem: null },
  steps: ["Find your position", "Create space", "Finish the movement"].map((title, index) => ({
    stepId: `fixture-step-${index}`, title, description: "Keep the upper step visible while consulting the reference card.",
  })),
};

function Fixture() {
  const root = useRef<HTMLElement>(null);
  const [sample, setSample] = useState("maths");
  const [media, setMedia] = useState(true);
  const [count, setCount] = useState(5);
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState("");
  const [capacity, setCapacity] = useState("");
  const card = { ...samples[sample], mediaKind: media ? samples[sample].mediaKind : undefined };

  useEffect(() => {
    // Open the real main-card Intro through its existing control, not a mock Step View.
    root.current?.querySelector<HTMLElement>(".active-card-identity[role=button]")?.click();
  }, []);

  useEffect(() => {
    const face = root.current?.querySelector<HTMLElement>("[data-info-card-face]");
    if (!face) return;
    const measure = () => {
      const header = face.querySelector<HTMLElement>("[data-info-card-header]")!;
      const body = face.querySelector<HTMLElement>("[data-info-card-body]")!;
      const fits = header.scrollWidth <= header.clientWidth + 1 && body.scrollHeight <= body.clientHeight + 1;
      const rect = face.getBoundingClientRect();
      setCapacity(`${fits ? "Fits" : "OVER CAPACITY — deliberately unsuitable sample"} · ${Math.round(rect.width)} × ${Math.round(rect.height)} px. ${card.body.length} body characters.`);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(face);
    return () => observer.disconnect();
  }, [sample, media, expanded, count, card.body.length]);

  return <main ref={root} className={`app-shell ${styles.fixture}`}>
    <header className={styles.toolbar}>
      <p>Info Cards · Phase 1A</p>
      <div className={styles.controls}>
        <label>Sample <select value={sample} onChange={(event) => { setSample(event.target.value); setStatus(""); }}>
          <option value="maths">Maths</option><option value="basketball">Basketball</option>
          <option value="tall-lines">Three taller lines</option><option value="long-header">Long header (fails)</option>
          <option value="over-capacity">Long body (fails)</option>
        </select></label>
        <label><input type="checkbox" checked={media} onChange={(event) => setMedia(event.target.checked)} /> Media</label>
        <label><input type="checkbox" checked={count > 0} onChange={(event) => { setCount(event.target.checked ? 5 : 0); setExpanded(false); }} /> Attachments</label>
        <button type="button" aria-pressed={expanded} disabled={count === 0} onClick={() => setExpanded((value) => !value)}>Static open</button>
      </div>
    </header>
    <FocusedCardView
      card={mainCard} cardIndex={0} totalCards={1} deckTemplateId="fixture" isDeckFlipped={false}
      traversalDirection="next" transition={{ duration: 0 }}
      onClose={() => setStatus("Use the main-card introduction to reopen Step View.")}
      onNext={() => {}} onPrevious={() => {}}
      stepViewMediaPreview={<svg viewBox="240 494 464 822" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Approved pull-up video still; static preview">
        <image href="/info-card-references/closed-step-view.png" width="941" height="1672" />
      </svg>}
      stepViewInfoCards={count > 0 ? {
        count, expanded, controlsId: "static-info-card", onToggle: () => setExpanded((value) => !value),
        content: <div data-tall-lines={sample === "tall-lines" ? "true" : undefined}>
          <InfoCardFace key={`${sample}:${media}`} card={card} onOpenMedia={() => setStatus("Media control tapped. The nested media viewer is Phase 1C.")} />
        </div>,
      } : undefined}
    />
    <aside className={styles.notes}>
      <p>Static geometry only. Animation, swiping, playback and full gesture isolation follow in 1B/1C.</p>
      {expanded && count > 0 ? <output aria-live="polite" data-capacity-report="">{capacity}</output> : null}
      {status ? <p role="status">{status}</p> : null}
    </aside>
  </main>;
}

createRoot(document.getElementById("fixture-root")!).render(<Fixture />);
