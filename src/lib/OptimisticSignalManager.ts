export type SignalState = { reading: number | null; rawReading: number | null };

type SignalQueue = {
  inFlight: boolean;
  nextReading: number | null;
};

export class OptimisticSignalManager {
  private confirmedReadings: Record<string, SignalState> = {};
  private queues: Record<string, SignalQueue> = {};

  constructor(
    private persistFn: (cardId: string, signalId: string, reading: number) => Promise<void>,
    private onRollback: (cardId: string, signalId: string, restored: SignalState) => void
  ) {}

  public getConfirmedSignal(
    cardId: string,
    signalId: string,
    currentReading: number | null,
    currentRawReading: number | null
  ): SignalState {
    const key = `${cardId}:${signalId}`;
    if (!(key in this.confirmedReadings)) {
      this.confirmedReadings[key] = {
        reading: currentReading,
        rawReading: currentRawReading,
      };
    }
    return this.confirmedReadings[key];
  }

  public setOptimisticReading(cardId: string, signalId: string, reading: number) {
    const key = `${cardId}:${signalId}`;
    let q = this.queues[key];

    if (!q) {
      q = { inFlight: false, nextReading: null };
      this.queues[key] = q;
    }

    if (q.inFlight) {
      // Coalesce intermediate updates: only track the most recent desired reading
      q.nextReading = reading;
      return;
    }

    // Start a new background processor for this signal
    void this.processQueue(cardId, signalId, reading);
  }

  private async processQueue(cardId: string, signalId: string, targetReading: number) {
    const key = `${cardId}:${signalId}`;
    const q = this.queues[key];

    q.inFlight = true;
    q.nextReading = null;

    try {
      await this.persistFn(cardId, signalId, targetReading);

      // Update confirmed state to the successful persistence
      this.confirmedReadings[key] = { reading: targetReading, rawReading: targetReading };
    } catch (error) {
      console.warn("Unable to persist signal reading.", error);

      // Only rollback if no newer adjustment is waiting
      if (q.nextReading === null) {
        this.onRollback(cardId, signalId, this.confirmedReadings[key]);
      }
    } finally {
      q.inFlight = false;

      // If the user made another adjustment while this was in flight, process it immediately
      if (q.nextReading !== null) {
        const next = q.nextReading;
        q.nextReading = null;
        void this.processQueue(cardId, signalId, next);
      }
    }
  }
}
