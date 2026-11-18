import assert from "node:assert/strict";
import test from "node:test";
import { getSafeReturnTo } from "../src/lib/returnTo";

test("internal return targets reject normalized and encoded external or login redirects", () => {
  for (const value of [undefined, "https://example.com", "//example.com", "/\\example.com", "/%5cexample.com", "/%255cexample.com", "/%2fexample.com", "/%252fexample.com", "/%6cogin?x=1", "/login", "/login/again", "/\n/example.com", "/%00x", "/%", "/" + "a".repeat(2048)]) {
    assert.equal(getSafeReturnTo(value), "/decks", String(value));
  }
  for (const value of ["/", "/decks?deckId=one", "/library", "/interactive-visuals/roots-and-factors?claimId=123", "/progress#maths"]) assert.equal(getSafeReturnTo(value), value);
});
