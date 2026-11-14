import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import PerspectivePicker, { type PerspectiveChoice } from "../src/components/group-experiences/PerspectivePicker";
import PerspectiveGrid from "../src/components/group-experiences/PerspectiveGrid";
import { buildGroupContentToggleLayout } from "../src/components/group-experiences/groupContentToggleLayout";

// Checkpoint 4.5c: the Include Group content toggle (decisions V3 to V5).
const follower = { perspective: "follower" as const, subjectUserId: "bea" };
test("the toggle is offered only to inspectors, is off by default, and applies only to follower inspection", () => {
  assert.deepEqual(buildGroupContentToggleLayout({ canInspectFollowers: false, selection: follower, includeGroupContent: false }),
    { visible: false, checked: false, disabled: false, applies: false, tag: null });
  assert.deepEqual(buildGroupContentToggleLayout({ canInspectFollowers: true, selection: follower, includeGroupContent: false }),
    { visible: true, checked: false, disabled: false, applies: false, tag: null });
  assert.deepEqual(buildGroupContentToggleLayout({ canInspectFollowers: true, selection: follower, includeGroupContent: true }),
    { visible: true, checked: true, disabled: false, applies: true, tag: "+ Group" });
  // Shown but disabled where it has no effect; its setting is kept for the next follower.
  for (const selection of [{ perspective: "group" as const }, { perspective: "self" as const }])
    assert.deepEqual(buildGroupContentToggleLayout({ canInspectFollowers: true, selection, includeGroupContent: true }),
      { visible: true, checked: true, disabled: true, applies: false, tag: null }, selection.perspective);
});

const choices: PerspectiveChoice[] = [{ key: "group", name: "U14s", group: true, selection: { perspective: "group" } },
  { key: "ann", name: "Ann", selection: { perspective: "self" } }, { key: "bea", name: "Eamonn", selection: follower }];
const on = { layout: buildGroupContentToggleLayout({ canInspectFollowers: true, selection: follower, includeGroupContent: true }), onChange() {} };
test("the status chip and the comparison header show the + Group tag on the same line as the name", () => {
  const chip = renderToStaticMarkup(<PerspectivePicker choices={choices} selected="bea" ownKey="ann" canCompare focused={false} disabled={false}
    onSelect={() => {}} onCompare={() => {}} groupContent={on} />);
  assert.match(chip, /<span class="group-identity-name">Eamonn<\/span><span class="group-content-tag">\+ Group<\/span>/);
  const off = renderToStaticMarkup(<PerspectivePicker choices={choices} selected="bea" ownKey="ann" canCompare focused={false} disabled={false}
    onSelect={() => {}} onCompare={() => {}} groupContent={{ ...on, layout: { ...on.layout, checked: false, applies: false, tag: null } }} />);
  assert.ok(!off.includes("group-content-tag"));
  const grid = renderToStaticMarkup(<PerspectiveGrid choices={choices} selected="bea" groupName="U14s" onSelect={() => {}} onCollapse={() => {}} groupContent={on} />);
  assert.match(grid, /<header><span>U14s · Eamonn<span class="group-content-tag"> \+ Group<\/span><\/span>/);
});

test("the grid keeps the toggle in a fixed row after the scrolling tiles, as a single labelled switch", () => {
  const grid = renderToStaticMarkup(<PerspectiveGrid choices={choices} selected="bea" groupName="U14s" onSelect={() => {}} onCollapse={() => {}} groupContent={on} />);
  const scroll = grid.indexOf('class="group-comparison-scroll"'), row = grid.indexOf('class="group-content-row"');
  assert.ok(scroll > 0 && row > scroll, "the row follows the scrolling area, outside it");
  assert.ok(grid.slice(scroll, row).includes("group-identity-card") && !grid.slice(scroll, row).includes('role="switch"'));
  assert.match(grid, /role="switch" class="group-content-toggle" aria-checked="true"/);
  assert.ok(grid.includes(">Include Group content<"));
  assert.equal((grid.match(/role="switch"/g) ?? []).length, 1);
  const hidden = renderToStaticMarkup(<PerspectiveGrid choices={choices} selected="bea" groupName="U14s" onSelect={() => {}} onCollapse={() => {}}
    groupContent={{ ...on, layout: { ...on.layout, visible: false } }} />);
  assert.ok(!hidden.includes("group-content-row"), "never offered to a viewer who cannot inspect followers");
  const dimmed = renderToStaticMarkup(<PerspectiveGrid choices={choices} selected="group" groupName="U14s" onSelect={() => {}} onCollapse={() => {}}
    groupContent={{ ...on, layout: buildGroupContentToggleLayout({ canInspectFollowers: true, selection: { perspective: "group" }, includeGroupContent: true }) }} />);
  assert.match(dimmed, /aria-checked="true" disabled=""/);
});
