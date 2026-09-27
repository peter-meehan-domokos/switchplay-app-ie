const fs = require('fs');

function replaceFileContent(filePath, target, replacement) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes(replacement.trim().substring(0, 50))) {
    console.log(`Already patched ${filePath}`);
    return;
  }
  if (!content.includes(target)) {
    console.error(`Target not found in ${filePath}`);
    return;
  }
  content = content.replace(target, replacement);
  fs.writeFileSync(filePath, content);
  console.log(`Patched ${filePath}`);
}

// 1. types.ts
replaceFileContent(
  'src/components/decks/types.ts',
`export type UserCardSignalReading = {
  signalId: string;
  reading: number;
};`,
`export type UserCardSignalReading = {
  signalId: string;
  reading: number | null;
};`
);

replaceFileContent(
  'src/components/decks/types.ts',
`export type WeeklyCardSignal = {
  id: string;
  title: string;
  order: SignalOrder | null;
  reading: number;
  unit: string | null;
};`,
`export type WeeklyCardSignal = {
  id: string;
  title: string;
  order: SignalOrder | null;
  reading: number | null;
  rawReading: number | null;
  unit: string | null;
};`
);

// 2. cardLayout.ts
replaceFileContent(
  'src/components/cards/cardLayout.ts',
`export type CardLayoutSignal = {
  id: string;
  title: string;
  value: number;
  reading: number;
  variant: SignalVariant;
  unit: string | null;
  order: SignalOrder;
};`,
`export type CardLayoutSignal = {
  id: string;
  title: string;
  value: number;
  reading: number | null;
  rawReading: number | null;
  variant: SignalVariant;
  unit: string | null;
  order: SignalOrder;
};`
);

replaceFileContent(
  'src/components/cards/cardLayout.ts',
`function normalizeSignal(signal: RawCardSignal, index: number): CardLayoutSignal {
  const order = "increasing";

  // Keep reading precision for field position continuity; display rounding stays in UI.
  const reading = clampSignalReading(signal.reading);

  return {
    id: signal.id,
    title: signal.title,
    value: signalReadingToNormalized(reading),
    reading,
    variant: signalVariants[index] ?? "movement",
    unit: signal.unit,
    order,
  };
}`,
`function normalizeSignal(signal: RawCardSignal, index: number): CardLayoutSignal {
  const order = "increasing";

  // Keep reading precision for field position continuity; display rounding stays in UI.
  const reading = signal.reading === null ? null : clampSignalReading(signal.reading);

  return {
    id: signal.id,
    title: signal.title,
    value: reading === null ? 0 : signalReadingToNormalized(reading),
    reading,
    rawReading: signal.rawReading ?? null,
    variant: signalVariants[index] ?? "movement",
    unit: signal.unit,
    order,
  };
}`
);

// 3. deckData.ts
replaceFileContent(
  'src/lib/deckData.ts',
`function createEmptyClientUserCardDataFromTemplate(templateCard: DeckTemplate["cards"][number]): ClientUserCardData {
  return {
    cardId: templateCard.cardId,
    targetDate: resolveDateOnly(templateCard.suggestedTargetDate),
    steps: templateCard.steps.map((step) => ({
      stepId: step.stepId,
      completionStatus: "todo",
    })),
    signalReadings: IMPLICIT_SIGNAL_IDS.map((signalId) => ({
      signalId,
      reading: DEFAULT_SIGNAL_READING,
    })),`,
`export function createEmptyClientUserCardDataFromTemplate(templateCard: DeckTemplate["cards"][number]): ClientUserCardData {
  return {
    cardId: templateCard.cardId,
    targetDate: resolveDateOnly(templateCard.suggestedTargetDate),
    steps: templateCard.steps.map((step) => ({
      stepId: step.stepId,
      completionStatus: "todo",
    })),
    signalReadings: IMPLICIT_SIGNAL_IDS.map((signalId) => ({
      signalId,
      reading: null,
    })),`
);

replaceFileContent(
  'src/lib/deckData.ts',
`          const reading =
            fixedReading !== undefined
              ? clampSignalReading(fixedReading)
              : legacyReading !== undefined
                ? clampSignalReading(legacyReading)
                : DEFAULT_SIGNAL_READING;

          const step = templateCard.steps[signalIndex];
          const displayTitle = step?.title || legacySignal?.title || getStreamTitle(template, signalIndex);

          return {
            id: signalId,
            title: displayTitle,
            order: "increasing" as const,
            reading,
            unit: null,
          };`,
`          const rawReading =
            fixedReading !== undefined
              ? fixedReading
              : legacyReading !== undefined
                ? legacyReading
                : null;
                
          const reading = rawReading === null ? null : clampSignalReading(rawReading);

          const step = templateCard.steps[signalIndex];
          const displayTitle = step?.title || legacySignal?.title || getStreamTitle(template, signalIndex);

          return {
            id: signalId,
            title: displayTitle,
            order: "increasing" as const,
            reading,
            rawReading,
            unit: null,
          };`
);

// 4. deckDataReconciliation.ts
replaceFileContent(
  'src/lib/deckDataReconciliation.ts',
`function createDefaultSignalReadings() {
  return IMPLICIT_SIGNAL_IDS.map((signalId) => ({
    signalId,
    reading: DEFAULT_SIGNAL_READING,
  }));
}`,
`function createDefaultSignalReadings() {
  return IMPLICIT_SIGNAL_IDS.map((signalId) => ({
    signalId,
    reading: null,
  }));
}`
);

replaceFileContent(
  'src/lib/deckDataReconciliation.ts',
`          const reading =
            existingFixedReading !== undefined
              ? clampSignalReading(existingFixedReading.reading)
              : existingLegacyReading !== undefined
                ? clampSignalReading(existingLegacyReading.reading)
                : DEFAULT_SIGNAL_READING;

          return {
            signalId,
            reading,
          };`,
`          const rawReading =
            existingFixedReading !== undefined
              ? existingFixedReading.reading
              : existingLegacyReading !== undefined
                ? existingLegacyReading.reading
                : null;
                
          const reading = rawReading === null ? null : clampSignalReading(rawReading);

          return {
            signalId,
            reading,
          };`
);

// 5. route.ts
replaceFileContent(
  'src/app/api/decks-data/route.ts',
`      signalReadings: IMPLICIT_SIGNAL_IDS.map((signalId) => ({
        signalId,
        reading: DEFAULT_SIGNAL_READING,
      })),`,
`      signalReadings: IMPLICIT_SIGNAL_IDS.map((signalId) => ({
        signalId,
        reading: null,
      })),`
);

// 6. signals.ts
replaceFileContent(
  'src/lib/signals.ts',
`export const SIGNAL_MIN = 1;
export const SIGNAL_MAX = 10;`,
`import { mean } from "d3-array";

export const SIGNAL_MIN = 1;
export const SIGNAL_MAX = 10;`
);

replaceFileContent(
  'src/lib/signals.ts',
`  return SIGNAL_MIN + clampedNormalizedValue * (SIGNAL_MAX - SIGNAL_MIN);
}
`,
`  return SIGNAL_MIN + clampedNormalizedValue * (SIGNAL_MAX - SIGNAL_MIN);
}

export function getDeckConfidenceScore(
  cards: Array<{ signals: Array<{ rawReading: number | null | unknown }> }>
): number | null {
  const validReadings = cards
    .flatMap((card) => card.signals.map((s) => s.rawReading))
    .filter((r): r is number => typeof r === "number" && Number.isFinite(r) && r >= 1 && r <= 10);

  const result = mean(validReadings);

  return result === undefined ? null : Math.round(result);
}
`
);

// 7. deckLayout.ts
replaceFileContent(
  'src/components/decks/deckLayout.ts',
`import { buildCardLayout, type CardLayout, type CardLayoutOptions, withDerivedCardProgress } from "@/components/cards/cardLayout";
import type { Deck } from "@/components/decks/types";
import { getProgressPercentage } from "@/lib/progress";`,
`import { buildCardLayout, type CardLayout, type CardLayoutOptions, withDerivedCardProgress } from "@/components/cards/cardLayout";
import type { Deck } from "@/components/decks/types";
import { getProgressPercentage } from "@/lib/progress";
import { getDeckConfidenceScore } from "@/lib/signals";`
);

replaceFileContent(
  'src/components/decks/deckLayout.ts',
`export type DeckLayout = Omit<Deck, "cards"> & {
  cards: CardLayout[];
  progressPercentage: number;
};`,
`export type DeckLayout = Omit<Deck, "cards"> & {
  cards: CardLayout[];
  progressPercentage: number;
  confidenceScore: number | null;
};`
);

replaceFileContent(
  'src/components/decks/deckLayout.ts',
`  const progressPercentage = getProgressPercentage(
    deck.cards.flatMap((card) =>
      card.steps.map((step) => ({ completionStatus: step.completionStatus }))
    )
  );

  return {
    ...deck,
    cards: deck.cards.map((card) => buildCardLayout(card, options)),
    progressPercentage,
  };`,
`  const progressPercentage = getProgressPercentage(
    deck.cards.flatMap((card) =>
      card.steps.map((step) => ({ completionStatus: step.completionStatus }))
    )
  );
  
  const confidenceScore = getDeckConfidenceScore(deck.cards);

  return {
    ...deck,
    cards: deck.cards.map((card) => buildCardLayout(card, options)),
    progressPercentage,
    confidenceScore,
  };`
);

replaceFileContent(
  'src/components/decks/deckLayout.ts',
`  const progressPercentage = getProgressPercentage(
    optimisticCards.flatMap((card) =>
      card.steps.map((step) => ({ completionStatus: step.completionStatus }))
    )
  );

  return {
    ...deck,
    cards: optimisticCards,
    progressPercentage,
  };`,
`  const progressPercentage = getProgressPercentage(
    optimisticCards.flatMap((card) =>
      card.steps.map((step) => ({ completionStatus: step.completionStatus }))
    )
  );
  
  const confidenceScore = getDeckConfidenceScore(optimisticCards);

  return {
    ...deck,
    cards: optimisticCards,
    progressPercentage,
    confidenceScore,
  };`
);

// 8. DeckTile.tsx
replaceFileContent(
  'src/components/decks/DeckTile.tsx',
`      <span className="deck-tile-meta">{isPreparing ? "Preparing deck..." : \`\${deck.cards.length} cards · \${progressMetaLabel}\`}</span>`,
`      <span className="deck-tile-meta">
        {isPreparing ? (
          "Preparing deck..."
        ) : (
          <>
            {deck.cards.length} cards &middot; {progressMetaLabel}
            {deck.confidenceScore !== null && (
              <span className="deck-tile-meta-confidence">{deck.confidenceScore}</span>
            )}
          </>
        )}
      </span>`
);

// 9. globals.css
replaceFileContent(
  'src/app/globals.css',
`.deck-tile-meta {
  position: relative;
  z-index: 1;
  margin-top: 8px;
  color: #aeb5c1;
  font-size: 0.78rem;
}`,
`.deck-tile-meta {
  position: relative;
  z-index: 1;
  margin-top: 8px;
  color: #aeb5c1;
  font-size: 0.78rem;
}

.deck-tile-meta-confidence {
  margin-left: 0.75rem;
  color: #fff;
  font-weight: 500;
}`
);

replaceFileContent(
  'src/app/globals.css',
`.detail-progress {
  margin: 0;
  color: rgba(198, 204, 214, 0.72);
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}`,
`.detail-progress,
.detail-confidence {
  margin: 0;
  color: rgba(198, 204, 214, 0.72);
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}`
);

// 10. DeckDetail.tsx
replaceFileContent(
  'src/components/decks/DeckDetail.tsx',
`        <div className="detail-progress-row">
          <p className="detail-progress">{Math.round(optimisticDeck.progressPercentage) === 100 ? "Completed" : \`Completion \${Math.round(optimisticDeck.progressPercentage)}%\`}</p>
          {deckIntroVideo && !isFocusModeOpen ? (`,
`        <div className="detail-progress-row">
          <p className="detail-progress">{Math.round(optimisticDeck.progressPercentage) === 100 ? "Completed" : \`Completion \${Math.round(optimisticDeck.progressPercentage)}%\`}</p>
          {optimisticDeck.confidenceScore !== null && (
            <p className="detail-confidence">Confidence {optimisticDeck.confidenceScore}</p>
          )}
          {deckIntroVideo && !isFocusModeOpen ? (`
);

replaceFileContent(
  'src/components/decks/DeckDetail.tsx',
`  const commitFocusedSignalReading = (cardId: string, signalId: string, reading: number) => {
    if (!deck.canMutate) {
      return;
    }

    const nextReading = roundSignalReadingForStorage(reading);
    const nextCards = cardsRef.current.map((card) => {
      if (card.id !== cardId) {
        return card;
      }

      return {
        ...card,
        signals: card.signals.map((signal) =>
          signal.id === signalId
            ? {
                ...signal,
                reading: nextReading,
              }
            : signal
        ),
      };
    });

    cardsRef.current = nextCards;
    setCards(nextCards);

    if (!deck.hasUserDeckData) {
      return;
    }

    void persistSignalReading(deck.deckTemplateId, cardId, signalId, nextReading).catch((error) => {
      console.warn("Unable to persist signal reading.", error);
    });
  };`,
`  const commitFocusedSignalReading = (cardId: string, signalId: string, reading: number) => {
    if (!deck.canMutate) {
      return;
    }

    const nextReading = roundSignalReadingForStorage(reading);
    const previousCards = cardsRef.current;
    const nextCards = previousCards.map((card) => {
      if (card.id !== cardId) {
        return card;
      }

      return {
        ...card,
        signals: card.signals.map((signal) =>
          signal.id === signalId
            ? {
                ...signal,
                reading: nextReading,
              }
            : signal
        ),
      };
    });

    cardsRef.current = nextCards;
    setCards(nextCards);

    if (!deck.hasUserDeckData) {
      return;
    }

    void persistSignalReading(deck.deckTemplateId, cardId, signalId, nextReading).catch((error) => {
      console.warn("Unable to persist signal reading.", error);
      setCards((currentCards) => {
        const currentCard = currentCards.find((c) => c.id === cardId);
        const currentSignal = currentCard?.signals.find((s) => s.id === signalId);
        if (currentSignal && currentSignal.reading === nextReading) {
          const previousCard = previousCards.find((c) => c.id === cardId);
          const previousSignal = previousCard?.signals.find((s) => s.id === signalId);
          if (previousSignal) {
            const revertedCards = currentCards.map((c) =>
              c.id === cardId
                ? {
                    ...c,
                    signals: c.signals.map((s) =>
                      s.id === signalId ? { ...s, reading: previousSignal.reading } : s
                    ),
                  }
                : c
            );
            cardsRef.current = revertedCards;
            return revertedCards;
          }
        }
        return currentCards;
      });
    });
  };`
);

// 11. BackCardFaceContent.tsx
replaceFileContent(
  'src/components/decks/BackCardFaceContent.tsx',
`function clampNormalized(value: number) {
  return Math.min(Math.max(value, 0), 1);
}`,
`export function clampNormalized(value: number) {
  return Math.min(Math.max(value, 0), 1);
}`
);

replaceFileContent(
  'src/components/decks/BackCardFaceContent.tsx',
`function getSignalGestureAxis(deltaX: number, deltaY: number): "horizontal" | "vertical" | null {`,
`export function getSignalGestureAxis(deltaX: number, deltaY: number): "horizontal" | "vertical" | null {`
);

replaceFileContent(
  'src/components/decks/BackCardFaceContent.tsx',
`function PassiveSignalRow({ signal }: { signal: CardLayout["signals"][number] }) {
  const displayedReading = snapReadingToInteger(signal.reading);
  const displayedReadingLabel = formatDisplayedSignalReading(signal, displayedReading);`,
`function PassiveSignalRow({ signal }: { signal: CardLayout["signals"][number] }) {
  const displayedReading = signal.reading === null ? null : snapReadingToInteger(signal.reading);
  const displayedReadingLabel = displayedReading === null ? "" : formatDisplayedSignalReading(signal, displayedReading);`
);

replaceFileContent(
  'src/components/decks/BackCardFaceContent.tsx',
`  const displayedReading = useMemo(() => {
    const reading = normalizedToSignalReading(effectiveNormalized);

    return clampSignalReading(snapReadingToInteger(reading));
  }, [effectiveNormalized]);
  const displayedReadingLabel = useMemo(
    () => formatDisplayedSignalReading(signal, displayedReading),
    [displayedReading, signal]
  );`,
`  const displayedReading = useMemo(() => {
    if (signal.reading === null && previewNormalized === null) {
      return null;
    }
    const reading = normalizedToSignalReading(effectiveNormalized);

    return clampSignalReading(snapReadingToInteger(reading));
  }, [effectiveNormalized, signal.reading, previewNormalized]);
  
  const displayedReadingLabel = useMemo(() => {
    if (displayedReading === null) {
      return "Drag to set";
    }
    return formatDisplayedSignalReading(signal, displayedReading);
  }, [displayedReading, signal]);`
);

replaceFileContent(
  'src/components/decks/BackCardFaceContent.tsx',
`  const signalRowClassName = "focused-card-signal-slot";
  const signalValueClassName = [
    "focused-card-signal-value",
    isValueVisible ? "focused-card-signal-value--visible" : "focused-card-signal-value--hidden",
  ].join(" ");`,
`  const signalRowClassName = "focused-card-signal-slot";
  const isUnset = signal.reading === null && previewNormalized === null;
  const signalValueClassName = [
    "focused-card-signal-value",
    isValueVisible || isUnset ? "focused-card-signal-value--visible" : "focused-card-signal-value--hidden",
  ].join(" ");`
);

replaceFileContent(
  'src/components/decks/BackCardFaceContent.tsx',
`      <div
        ref={signalTrackRef}
        className="focused-card-signal-track"
        style={{ "--signal-value-position": getSignalValuePositionPercent(effectiveNormalized) } as CSSProperties}
      >
        <span className={signalValueClassName} aria-hidden={!isValueVisible}>
          {displayedReadingLabel}
        </span>
        <PulseFieldSignal value={effectiveNormalized} variant={signal.variant} className="focused-card-signal-trace" />
      </div>`,
`      <div
        ref={signalTrackRef}
        className="focused-card-signal-track"
        style={{ "--signal-value-position": getSignalValuePositionPercent(effectiveNormalized) } as CSSProperties}
      >
        <span className={signalValueClassName} aria-hidden={!(isValueVisible || isUnset)}>
          {displayedReadingLabel}
        </span>
        <PulseFieldSignal value={effectiveNormalized} variant={signal.variant} className="focused-card-signal-trace" />
      </div>`
);
