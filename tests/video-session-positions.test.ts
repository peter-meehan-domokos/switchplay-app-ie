import { test } from "node:test";
import assert from "node:assert/strict";
import { activateVideoSession, readVideoSessionPosition, saveVideoSessionPosition, videoPositionKey } from "../src/lib/videoSessionPositions";

test("browser-only positions isolate attachment/source identity, reject invalid reads and clear account sessions", () => {
  const source = { assetId: "stream", src: "https://example.invalid/stream" };
  const key = videoPositionKey("card", "intro", "one", source);
  assert.equal(readVideoSessionPosition("alice", key), undefined); // SSR never persists.
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  try {
    activateVideoSession("alice"); saveVideoSessionPosition("alice", key, 12);
    assert.equal(readVideoSessionPosition("alice", key), 12);
    for (const position of [null, NaN, Infinity, -1]) saveVideoSessionPosition("alice", key, position);
    assert.equal(readVideoSessionPosition("alice", key), 12);
    assert.equal(readVideoSessionPosition("alice", videoPositionKey("card", "intro", "two", source)), undefined);
    assert.equal(readVideoSessionPosition("alice", videoPositionKey("card", "intro", "one", { ...source, assetId: "replacement" })), undefined);
    assert.equal(readVideoSessionPosition("bob", key), undefined);
    activateVideoSession("bob"); saveVideoSessionPosition("alice", key, 99); // Late outgoing cleanup cannot revive its session.
    activateVideoSession("alice"); assert.equal(readVideoSessionPosition("alice", key), undefined);
    saveVideoSessionPosition("alice", key, 0); assert.equal(readVideoSessionPosition("alice", key), 0);
    activateVideoSession(undefined); activateVideoSession("alice"); assert.equal(readVideoSessionPosition("alice", key), undefined);
  } finally { Reflect.deleteProperty(globalThis, "window"); activateVideoSession(undefined); }
});
