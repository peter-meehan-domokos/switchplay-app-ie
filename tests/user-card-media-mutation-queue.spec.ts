import { expect, test } from "@playwright/test";
import {
  createUserCardMediaMutationKey,
  UserCardMediaMutationQueue,
} from "@/lib/userCardMediaMutationQueue";

const cardA = { deckTemplateId: "deck-1", cardId: "card-a" };
const cardB = { deckTemplateId: "deck-1", cardId: "card-b" };

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });

  return { promise, resolve };
}

test("same-card mutations serialize while another card runs independently", async () => {
  const queue = new UserCardMediaMutationQueue();
  const firstGate = deferred();
  const events: string[] = [];

  const first = queue.enqueue(cardA, async () => {
    events.push("card-a image started");
    await firstGate.promise;
    events.push("card-a image saved");
  });
  const second = queue.enqueue(cardA, async () => {
    events.push("card-a video started");
    events.push("card-a video saved");
  });
  const otherCard = queue.enqueue(cardB, async () => {
    events.push("card-b image saved");
  });

  await otherCard;
  expect(events).toEqual(["card-a image started", "card-b image saved"]);

  firstGate.resolve();
  await Promise.all([first, second]);
  expect(events).toEqual([
    "card-a image started",
    "card-b image saved",
    "card-a image saved",
    "card-a video started",
    "card-a video saved",
  ]);
});

test("a failed mutation reports its own error without blocking later card mutations", async () => {
  const queue = new UserCardMediaMutationQueue();
  const failed = queue.enqueue(cardA, async () => {
    throw new Error("Append failed");
  });
  const later = queue.enqueue(cardA, async () => "Remove succeeded");

  await expect(failed).rejects.toThrow("Append failed");
  await expect(later).resolves.toBe("Remove succeeded");
});

test("confirmed response arrays apply in request order so an older result cannot erase a later item", async () => {
  const queue = new UserCardMediaMutationQueue();
  const firstGate = deferred();
  let stored = ["existing"];
  let displayed = ["existing"];

  const first = queue.enqueue(cardA, async () => {
    await firstGate.promise;
    stored = [...stored, "image"];
    displayed = [...stored];
  });
  const second = queue.enqueue(cardA, async () => {
    stored = [...stored, "video"];
    displayed = [...stored];
  });

  expect(displayed).toEqual(["existing"]);
  firstGate.resolve();
  await Promise.all([first, second]);
  expect(stored).toEqual(["existing", "image", "video"]);
  expect(displayed).toEqual(stored);
  expect(createUserCardMediaMutationKey(cardA)).not.toBe(createUserCardMediaMutationKey(cardB));
  expect(createUserCardMediaMutationKey(cardA)).not.toBe(createUserCardMediaMutationKey({ deckTemplateId: "deck-2", cardId: "card-a" }));
});
