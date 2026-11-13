import assert from "node:assert/strict";
import { test } from "node:test";
import { buildInfoCardStackLayout } from "../src/components/info-cards/infoCardStackLayout";
import { buildInfoCardTypeLayout, infoCardType } from "../src/components/info-cards/infoCardTypeLayout";

const card = (id: string, extra: Record<string, unknown> = {}) => ({ id, ...extra });

test("type layout maps each type to its approved colour and label", () => {
  assert.equal(buildInfoCardTypeLayout("creator").stripBackground, "linear-gradient(145deg, #303947, #252d39)");
  assert.equal(buildInfoCardTypeLayout("personal").stripBackground, "#305047");
  assert.equal(buildInfoCardTypeLayout("groupAdmin").stripBackground, "#147d6c");
  assert.deepEqual(["creator", "personal", "groupAdmin"].map(type => buildInfoCardTypeLayout(type as "creator").label), ["Creator", "Personal", "Group"]);
});
test("a card type comes from an explicit type, else the personal flag", () => {
  assert.equal(infoCardType({}), "creator");
  assert.equal(infoCardType({ personal: true }), "personal");
  assert.equal(infoCardType({ personal: true, infoType: "groupAdmin" }), "groupAdmin");
});
test("no strips for a single card; one fewer than the card count up to four", () => {
  assert.deepEqual(buildInfoCardStackLayout([], 0), []);
  assert.deepEqual(buildInfoCardStackLayout([card("a")], 0), []);
  for (const [count, strips] of [[2, 1], [3, 2], [5, 4], [6, 4], [9, 4]]) {
    assert.equal(buildInfoCardStackLayout(Array.from({ length: count }, (_, i) => card(`c${i}`)), 0).length, strips, `${count} cards`);
  }
});
test("strips follow the upcoming cards in order, wrapping past the end, never the current card", () => {
  const cards = ["a", "b", "c", "d", "e"].map(id => card(id));
  assert.deepEqual(buildInfoCardStackLayout(cards, 0).map(s => s.id), ["b", "c", "d", "e"]);
  assert.deepEqual(buildInfoCardStackLayout(cards, 3).map(s => s.id), ["e", "a", "b", "c"]);
  assert.deepEqual(buildInfoCardStackLayout(cards.slice(0, 3), 2).map(s => s.id), ["a", "b"]);
});
test("a stack of three Creator and two Personal cards shows the mixture in order", () => {
  const cards = [card("1"), card("2", { personal: true }), card("3"), card("4", { personal: true }), card("5")];
  const strips = buildInfoCardStackLayout(cards, 0);
  assert.deepEqual(strips.map(s => s.type), ["personal", "creator", "personal", "creator"]);
  assert.deepEqual(strips.map(s => s.background), ["#305047", "linear-gradient(145deg, #303947, #252d39)", "#305047", "linear-gradient(145deg, #303947, #252d39)"]);
});
test("each strip reveals about five pixels and recedes inward", () => {
  const strips = buildInfoCardStackLayout(["a", "b", "c", "d", "e"].map(id => card(id)), 0);
  assert.deepEqual(strips.map(s => s.offset), [5, 10, 15, 20]);
  assert.deepEqual(strips.map(s => s.inset), [4, 8, 12, 16]);
});
test("Group Admin and unavailable cards keep their own strip colours", () => {
  const strips = buildInfoCardStackLayout([card("a"), card("b", { infoType: "groupAdmin" }), card("c", { unavailable: true })], 0);
  assert.deepEqual(strips.map(s => [s.type, s.background]), [["groupAdmin", "#147d6c"], ["unavailable", "#2c3543"]]);
});
test("the layout does not mutate its input", () => {
  const cards = Object.freeze([card("a"), card("b")]);
  assert.doesNotThrow(() => buildInfoCardStackLayout(cards, 0));
});
