import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import PerspectivePicker, { type PerspectiveChoice } from "../src/components/group-experiences/PerspectivePicker";
import PerspectiveGrid from "../src/components/group-experiences/PerspectiveGrid";
import { buildAdminContentToggleLayout } from "../src/components/group-experiences/adminContentToggleLayout";
import { defaultIncludeAdminContent } from "../src/lib/groupExperiences/media/contributionIdentity";

// The Include admin content toggle: one setting for every follower perspective, own Me included.
const follower = { perspective: "follower" as const, subjectUserId: "bea" };
const self = { perspective: "self" as const }, group = { perspective: "group" as const };
test("the default follows the viewer's role: on for a follower-only viewer, off for an admin or a dual-role admin", () => {
  assert.equal(defaultIncludeAdminContent({ isAdmin: false }), true, "follower-only");
  assert.equal(defaultIncludeAdminContent({ isAdmin: true }), false, "admin, with or without a follower role");
});
test("the toggle applies identically to own Me and an inspected follower, never to the Group perspective, and is always enabled", () => {
  for (const selection of [follower, self]) {
    assert.deepEqual(buildAdminContentToggleLayout({ hasFollowerPerspectives: true, selection, includeAdminContent: true }),
      { visible: true, checked: true, applies: true, tag: "+ Admin" }, selection.perspective);
    assert.deepEqual(buildAdminContentToggleLayout({ hasFollowerPerspectives: true, selection, includeAdminContent: false }),
      { visible: true, checked: false, applies: false, tag: null }, selection.perspective);
  }
  // In the Group perspective it can still be set before a follower is chosen, but changes nothing shown.
  assert.deepEqual(buildAdminContentToggleLayout({ hasFollowerPerspectives: true, selection: group, includeAdminContent: true }),
    { visible: true, checked: true, applies: false, tag: null });
  assert.equal(buildAdminContentToggleLayout({ hasFollowerPerspectives: false, selection: group, includeAdminContent: false }).visible, false,
    "not offered without any follower perspective in the chooser");
  assert.ok(!("disabled" in buildAdminContentToggleLayout({ hasFollowerPerspectives: true, selection: group, includeAdminContent: false })));
});

const choices: PerspectiveChoice[] = [{ key: "group", name: "U14s", group: true, selection: group },
  { key: "ann", name: "Ann", selection: self }, { key: "bea", name: "Eamonn", selection: follower }];
const layout = (selection: typeof follower | typeof self | typeof group, includeAdminContent = true) =>
  buildAdminContentToggleLayout({ hasFollowerPerspectives: true, selection, includeAdminContent });
const on = { layout: layout(follower), onChange() {} };
test("the status chip and the comparison header show the + Admin tag on the same line as the name, own Me included", () => {
  const chip = renderToStaticMarkup(<PerspectivePicker choices={choices} selected="bea" ownKey="ann" canCompare focused={false} disabled={false}
    onSelect={() => {}} onCompare={() => {}} adminContent={on} />);
  assert.match(chip, /<span class="group-identity-name">Eamonn<\/span><span class="admin-content-tag">\+ Admin<\/span>/);
  const me = renderToStaticMarkup(<PerspectivePicker choices={choices} selected="ann" ownKey="ann" canCompare focused={false} disabled={false}
    onSelect={() => {}} onCompare={() => {}} adminContent={{ ...on, layout: layout(self) }} />);
  assert.match(me, /<span class="group-identity-name">Ann<\/span><span class="admin-content-tag">\+ Admin<\/span>/);
  const off = renderToStaticMarkup(<PerspectivePicker choices={choices} selected="bea" ownKey="ann" canCompare focused={false} disabled={false}
    onSelect={() => {}} onCompare={() => {}} adminContent={{ ...on, layout: layout(follower, false) }} />);
  assert.ok(!off.includes("admin-content-tag"));
  const grid = renderToStaticMarkup(<PerspectiveGrid choices={choices} selected="bea" groupName="U14s" onSelect={() => {}} onCollapse={() => {}} adminContent={on} />);
  assert.match(grid, /<header><span>U14s · Eamonn<span class="admin-content-tag"> \+ Admin<\/span><\/span>/);
  assert.ok(!grid.includes("Group content") && !grid.includes("+ Group"));
});

test("the grid keeps the toggle in a fixed row after the scrolling tiles, as a single labelled switch, enabled on the Group perspective", () => {
  const grid = renderToStaticMarkup(<PerspectiveGrid choices={choices} selected="bea" groupName="U14s" onSelect={() => {}} onCollapse={() => {}} adminContent={on} />);
  const scroll = grid.indexOf('class="group-comparison-scroll"'), row = grid.indexOf('class="admin-content-row"');
  assert.ok(scroll > 0 && row > scroll, "the row follows the scrolling area, outside it");
  assert.ok(grid.slice(scroll, row).includes("group-identity-card") && !grid.slice(scroll, row).includes('role="switch"'));
  assert.match(grid, /role="switch" class="admin-content-toggle" aria-checked="true"/);
  assert.ok(grid.includes(">Include admin content<"));
  assert.equal((grid.match(/role="switch"/g) ?? []).length, 1);
  const hidden = renderToStaticMarkup(<PerspectiveGrid choices={choices} selected="bea" groupName="U14s" onSelect={() => {}} onCollapse={() => {}}
    adminContent={{ ...on, layout: { ...on.layout, visible: false } }} />);
  assert.ok(!hidden.includes("admin-content-row"));
  const onGroup = renderToStaticMarkup(<PerspectiveGrid choices={choices} selected="group" groupName="U14s" onSelect={() => {}} onCollapse={() => {}}
    adminContent={{ ...on, layout: layout(group) }} />);
  assert.match(onGroup, /role="switch" class="admin-content-toggle" aria-checked="true">/);
  assert.ok(!/role="switch"[^>]*disabled/.test(onGroup), "never disabled");
  assert.ok(!onGroup.includes("admin-content-tag"), "no tag on the Group perspective");
});
