import { createRoot } from "react-dom/client";
import { useEffect, useRef, useState } from "react";
import DeckScene from "@/components/decks/DeckScene";
import FocusedCardView from "@/components/decks/FocusedCardView";
import LibraryDialog from "@/components/library/LibraryDialog";
import type { CanonicalDeckPresentation } from "@/components/decks/presentation";
import type { CloudflareStreamVideoMediaItem } from "@/lib/media";
import type { InfoCardConsultationCard } from "@/components/info-cards/InfoCardConsultation";
import "@/app/globals.css";
import styles from "./info-cards-fixture.module.css";
import integration from "./info-cards-integration-fixture.module.css";

// Local MP4 exercises actual native decoding. It is not an HLS/provider test.
const canPlayType = HTMLMediaElement.prototype.canPlayType;
HTMLMediaElement.prototype.canPlayType = function (type) {
  return /mpegurl/i.test(type) ? "probably" : canPlayType.call(this, type);
};
const video = (id: string): CloudflareStreamVideoMediaItem => ({ id, assetId: `info-fixture-${id}`,
  mediaType: "video", provider: "cloudflare-stream", src: `https://videodelivery.net/info-fixture-${id}`,
  description: `Practice ${id}`, width: 192, height: 320 });
const deck: CanonicalDeckPresentation = {
  surface: "canonical", id: "info-fixture-deck", deckTemplateId: "info-fixture-deck", version: 1,
  title: "Info Cards integration", category: "general", introduction: null, ownerUsername: "Fixture", showOwnerTag: false,
  cards: [1, 2].map(index => ({ surface: "canonical", id: `info-fixture-card-${index}`, cardTemplateId: `info-fixture-card-${index}`, version: 1,
    label: `Practice ${index}`, creator: { username: "Fixture", immediateSourceUsername: null },
    intro: { title: "Start To Master It", description: "", mediaItem: video("intro") },
    steps: [1, 2, 3].map(step => ({ stepId: `step-${step}`, title: `Step ${step}`, description: "Pause to consult the reference, then continue manually.", mediaItem: video(`step-${step}`) })) })),
};

let activityMounts = 0;
function Activity() {
  const [mount] = useState(() => ++activityMounts);
  const [count, setCount] = useState(0);
  const [answer, setAnswer] = useState("");
  return <div className={integration.activity} data-test-activity="" data-mount={mount}>
    <label>Your answer<input value={answer} onChange={event => setAnswer(event.target.value)} /></label>
    <button type="button" onClick={() => setCount(value => value + 1)}>Attempts {count}</button>
    {Array.from({ length: 12 }, (_, index) => <p key={index}>Activity line {index + 1}: this content and scroll position should survive consultation.</p>)}
  </div>;
}

function Fixture() {
  const root = useRef<HTMLElement>(null);
  const [activity, setActivity] = useState(false);
  const [media, setMedia] = useState("image");
  const [revision, setRevision] = useState(1);
  const [visible, setVisible] = useState(true);
  const [version, setVersion] = useState(1);
  const [actor, setActor] = useState(1);
  const [isFlipped, setIsFlipped] = useState(false);
  const cards: InfoCardConsultationCard[] = [
    { id: "negative-signs", seriesTitle: "What You Need", seriesCreatorUsername: "peter", title: "Negative signs",
      body: `Keep every minus sign attached to its number. Use brackets to make the signs clear.\n\nTwo negatives multiply to make a positive. One negative gives a negative.${revision > 1 ? ` Updated ${revision}.` : ""}`,
      media: media === "video" ? video("info") : media === "image" ? { id: "info-image", mediaType: "image", src: "/image-0.svg", description: "Reference diagram" } : undefined },
    { id: "brackets", seriesTitle: "What You Need", seriesCreatorUsername: "peter", title: "Brackets", body: "Treat the contents of brackets as one quantity." },
  ];
  useEffect(() => {
    // Deliberate fixture controls for lifecycle/snapshot tests, not application globals.
    const fixture = window as unknown as { infoFixture: { update(): void; unmount(): void; changeVersion(): void; changeActor(): void } };
    fixture.infoFixture = { update: () => setRevision(value => value + 1), unmount: () => setVisible(false),
      changeVersion: () => setVersion(value => value + 1), changeActor: () => setActor(value => value + 1) };
  }, []);
  const content = <main ref={root} className={`app-shell ${styles.fixture}`}>
    <header className={styles.toolbar}><p>Info Cards · Phase 1C integration</p><div className={styles.controls}>
      <label>Step content<select value={activity ? "activity" : "video"} onChange={event => setActivity(event.target.value === "activity")}><option value="video">Real video</option><option value="activity">Stateful activity</option></select></label>
      <label>Info media<select value={media} onChange={event => setMedia(event.target.value)}><option value="image">Image</option><option value="video">Video</option><option value="none">None</option></select></label>
    </div></header>
    {visible ? <DeckScene deck={{ ...deck, version, cards: deck.cards.map(card => ({ ...card, version })) }} onBack={() => {}} transition={{ duration: 0 }}
      isDeckFlipped={isFlipped} onToggleDeckFlip={() => setIsFlipped(value => !value)}
      renderFocusedCard={props => <FocusedCardView {...props} infoCards={cards} playbackViewerUserId={`fixture-viewer-${actor}`}
        backFace={<div>Fixture card back</div>} renderStepActivity={activity ? () => <Activity /> : undefined} />} /> : null}
    <aside className={styles.notes}><p>Open a card, then Intro or a step. Play the sample, open the pouch, and close it: playback stays paused. Swiping the info stack is deferred to 1B.</p></aside>
  </main>;
  return new URLSearchParams(location.search).has("parent-dialog") ?
    <LibraryDialog title="Parent preview" isolateInteractions onCancel={() => setVisible(false)}>{content}</LibraryDialog> : content;
}
createRoot(document.getElementById("fixture-root")!).render(<Fixture />);
