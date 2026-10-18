import type { CardForkCommand, DeckForkCommand } from "@/lib/cards/model";
import { CreatorRequestError } from "./creatorRequest";

export type SubmittedCreatorOperation = {
  schema: 1; actor: string; sessionId: string; sourceDeckId: string; origin: string; submittedAt: number;
  kind: "card" | "deck"; command: CardForkCommand | DeckForkCommand;
};
export type CreatorRecoveryStorage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;
const prefix = "switchplay:creator-operation:v1:";
// Only submitted immutable commands. No editor buffer, File, credentials or provider upload URL.
export class CreatorRecoveryJournal {
  constructor(private storage: CreatorRecoveryStorage, readonly actor: string, readonly sourceDeckId: string) {}
  private get key() { return `${prefix}${this.actor}:${this.sourceDeckId}`; }
  isolate() {
    for (let index = this.storage.length - 1; index >= 0; index--) {
      const key = this.storage.key(index);
      if (key?.startsWith(prefix) && !key.startsWith(`${prefix}${this.actor}:`)) this.storage.removeItem(key);
    }
  }
  read(): SubmittedCreatorOperation | null {
    try {
      this.isolate();
      const raw = this.storage.getItem(this.key);
      if (!raw) return null;
      const value = JSON.parse(raw) as SubmittedCreatorOperation;
      if (value.schema !== 1 || value.actor !== this.actor || value.sourceDeckId !== this.sourceDeckId
        || !["card", "deck"].includes(value.kind) || !value.command || typeof value.sessionId !== "string" || typeof value.origin !== "string"
        || !Number.isFinite(value.submittedAt) || Date.now() - value.submittedAt > 24 * 60 * 60 * 1000) {
        throw new Error("Invalid recovery command");
      }
      return value;
    } catch { throw new CreatorRequestError(409, "CREATOR_RECOVERY_UNAVAILABLE"); }
  }
  write(operation: SubmittedCreatorOperation) {
    try {
      if (operation.actor !== this.actor || operation.sourceDeckId !== this.sourceDeckId || Date.now() - operation.submittedAt > 24 * 60 * 60 * 1000) throw new Error("Invalid operation");
      const previous = this.read();
      if (previous && JSON.stringify(previous) !== JSON.stringify(operation)) throw new Error("Unresolved operation");
      this.storage.setItem(this.key, JSON.stringify(operation));
      if (this.storage.getItem(this.key) !== JSON.stringify(operation)) throw new Error("Storage failed");
    } catch { throw new CreatorRequestError(409, "CREATOR_RECOVERY_UNAVAILABLE"); }
  }
  clear() { this.storage.removeItem(this.key); }
}
