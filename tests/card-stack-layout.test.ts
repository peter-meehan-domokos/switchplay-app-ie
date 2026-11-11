import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCardLayoutDependency } from "../src/components/decks/cardStackLayout";

const dependency = (zone: "past" | "active" | "future", focusModeOpen = false, sceneScale = .866) => buildCardLayoutDependency({ zone, focusModeOpen, sceneScale });

test("an unrelated re-render keeps every Card's layout dependency, so Framer does not re-snapshot it", () => {
  assert.equal(dependency("future"), dependency("future"));
  assert.equal(dependency("active"), dependency("active"));
});

test("opening or closing focus re-snapshots only the active Card", () => {
  assert.notEqual(dependency("active", true), dependency("active", false));
  assert.equal(dependency("future", true), dependency("future", false));
  assert.equal(dependency("past", true), dependency("past", false));
});

test("a zone change or a scene scale change re-snapshots the Card", () => {
  assert.notEqual(dependency("future"), dependency("active"));
  assert.notEqual(dependency("active"), dependency("past"));
  assert.notEqual(dependency("future", false, .866), dependency("future", false, 1));
});
