/** Browser-memory only. An account boundary discards the previous session. */
const positions = new Map<string, number>();
let activeActor: string | undefined;
const MAX_POSITIONS = 256;

export function videoPositionKey(cardId: string, destinationId: string, attachmentId: string, source: { assetId: string; src: string }) {
  return JSON.stringify([cardId, destinationId, attachmentId, source.assetId, source.src]);
}
export function activateVideoSession(actor: string | undefined) {
  if (actor !== activeActor) { positions.clear(); activeActor = actor; }
}
export function readVideoSessionPosition(actor: string | undefined, key: string) {
  if (typeof window === "undefined") return undefined;
  return actor === activeActor ? positions.get(key) : undefined;
}
export function saveVideoSessionPosition(actor: string | undefined, key: string, position: number | null) {
  if (typeof window === "undefined" || position === null || !Number.isFinite(position) || position < 0) return;
  if (actor !== activeActor) return;
  positions.delete(key); positions.set(key, position);
  if (positions.size > MAX_POSITIONS) positions.delete(positions.keys().next().value!);
}
