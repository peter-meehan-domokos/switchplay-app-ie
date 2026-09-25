type UserCardMediaMutationTarget = {
  deckTemplateId: string;
  cardId: string;
};

export function createUserCardMediaMutationKey(target: UserCardMediaMutationTarget) {
  return `user-card:${encodeURIComponent(target.deckTemplateId)}:${encodeURIComponent(target.cardId)}`;
}

export class UserCardMediaMutationQueue {
  private readonly pendingByCard = new Map<string, Promise<void>>();

  enqueue<Result>(target: UserCardMediaMutationTarget, operation: () => Promise<Result>): Promise<Result> {
    const key = createUserCardMediaMutationKey(target);
    const previous = this.pendingByCard.get(key) ?? Promise.resolve();
    const result = previous.then(operation);
    const settled = result.then(() => undefined, () => undefined);

    this.pendingByCard.set(key, settled);
    void settled.then(() => {
      if (this.pendingByCard.get(key) === settled) {
        this.pendingByCard.delete(key);
      }
    });

    return result;
  }
}
