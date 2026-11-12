import { expect, test } from "@playwright/test";
import { rootsFactorsLayout } from "../activities/roots-factors/rootsFactorsLayout";
import { card1Vertex, createCard1Math } from "../activities/roots-factors/model";
import { projectPoint } from "../core/graph/coordinatePlaneLayout";
import { layoutPreviewFixtures } from "../lab/layoutPreviewFixtures";
import { guidedPresentation, rootAdjustmentLayout } from "../activities/roots-factors/presentationLayouts";
import { rootTaskLayout, rootTaskSizingLayout } from "../core/expressions/rootTaskLayout";

test("the target-root task is immutable given notation, never a quadratic equation or current root", () => {
  const target = { id: "target", root: -4 };
  const scene = rootTaskLayout(target);
  expect(scene).toEqual({ label: "Factor:", factor: "(x + 4)", question: "Root = ?", accessibleDescription: "Factor: (x + 4). Root = ?" });
  expect(Object.isFrozen(scene)).toBe(true);
  expect(Object.isFrozen(target)).toBe(false);
  expect(JSON.parse(JSON.stringify(scene))).toEqual(scene);
  expect(JSON.stringify(scene)).not.toMatch(/f\(x\)|x = −4/);
  expect(rootTaskSizingLayout()).toEqual({ label: "0000000", factor: "0000000", question: "0000 0 0", accessibleDescription: "" });
});

test("Next is a secondary navigation action governed only by existing eligibility and editing policy", () => {
  for (const eligible of [false, true]) for (const editing of [false, true]) for (const active of [false, true]) {
    const prompt = guidedPresentation({ stage: "orientation" }, eligible, editing, active).prompt;
    expect(prompt.title).toBe("Explore");
    expect(prompt.actions).toEqual([]);
    expect(prompt.navigation).toMatchObject({ id: "ready", label: "Next", appearance: "secondary", enabled: eligible && !editing && active });
    expect(prompt.navigation?.unavailableReason).toBe(!eligible && !editing && active ? "Drag the green root to a new position first." : undefined);
  }
  // Retained portable adjustment preparation is available to future alternate interfaces.
  expect(rootAdjustmentLayout(0, true, [0, 5]).actions.map((action) => action.enabled)).toEqual([false, true]);
  expect(rootAdjustmentLayout(5, true, [0, 5]).actions.map((action) => action.enabled)).toEqual([true, false]);
});

test("static preview content retains the agreed maths and contains no enabled actions", () => {
  for (const fixture of Object.values(layoutPreviewFixtures)) {
    expect(fixture.presentation.prompt.actions.every((action) => !action.enabled)).toBe(true);
    expect(fixture.presentation.prompt.navigation?.enabled ?? false).toBe(false);
    expect(Object.isFrozen(fixture.presentation.prompt.actions)).toBe(true);
  }
  const reveal = layoutPreviewFixtures["incorrect-reveal"];
  expect(reveal.math.movingRoot).toBe(-3);
  expect(reveal.presentation.prompt.comparison).toEqual([
    { label: "Your choice", factor: "(x − 3)", substitution: "−3 − 3 = −6" },
    { label: "Correct factor", factor: "(x + 3)", substitution: "−3 + 3 = 0" },
  ]);
  expect(layoutPreviewFixtures.assistance.presentation.prompt.working).toEqual(["(x + 4) = 0", "x = −4"]);
});

test("masking removes the live factor from expression and graph descriptions", () => {
  for (const key of ["retrieval", "assistance"] as const) {
    const fixture = layoutPreviewFixtures[key];
    const scene = rootsFactorsLayout(fixture.math, { width: 336, height: 224 }, fixture.presentation.policy);
    expect(scene.expression.factors[1].text).toBe("( ? )");
    expect(scene.expression.accessibleDescription).toContain("a hidden factor");
    expect(scene.graph.accessibleDescription).not.toContain("(x + 3)");
  }
});

test("marker geometry accommodates 48px targets, coincidence and edge roots without moving the mathematical centre", () => {
  for (const size of [{ width: 296, height: 210 }, { width: 336, height: 224 }, { width: 366, height: 244 }]) {
    for (let r = -5; r <= 5; r++) {
      const math = createCard1Math(r);
      const { graph } = rootsFactorsLayout(math, size);
      const [fixed, moving] = graph.roots.markers;
      expect(moving.center).toEqual(projectPoint(graph.plane.projection, { x: r, y: 0 }));
      expect(moving.hitRegion?.width).toBe(48);
      expect(moving.hitRegion?.height).toBe(48);
      expect(moving.hitRegion!.x).toBeGreaterThanOrEqual(0);
      expect(moving.hitRegion!.x + 48).toBeLessThanOrEqual(size.width);
      expect(fixed.hitRegion).toBeNull();
      expect(fixed.haloRadius).toBeNull();
      expect(moving.labelBackground!.y).toBeGreaterThanOrEqual(0);
      expect(moving.labelBackground!.x).toBeGreaterThanOrEqual(0);
      expect(moving.labelBackground!.x + moving.labelBackground!.width).toBeLessThanOrEqual(size.width);
      expect(moving.labelBackground!.y + moving.labelBackground!.height).toBeLessThan(moving.hitRegion!.y);
      for (const segment of moving.movementCue) {
        expect(segment.end.x).toBeGreaterThanOrEqual(graph.plane.projection.plot.x);
        expect(segment.end.x).toBeLessThanOrEqual(graph.plane.projection.plot.x + graph.plane.projection.plot.width);
        if (r !== 1) expect(Math.abs(segment.end.x - fixed.center.x)).toBeGreaterThan(fixed.visibleRadius + 1);
      }
    }
  }
});

test("movement cues are orientation-only and halo is absent in locked presentations", () => {
  for (const fixture of Object.values(layoutPreviewFixtures)) {
    const { graph } = rootsFactorsLayout(fixture.math, { width: 336, height: 224 }, fixture.presentation.policy);
    const moving = graph.roots.markers[1];
    expect(moving.movementCue.length > 0).toBe(fixture.presentation.policy.markerPresentation === "orientation");
    expect(moving.haloRadius !== null).toBe(fixture.presentation.policy.markerPresentation !== "locked");
  }
});

test("compact fixed label surface remains below the axis without proximity jumps", () => {
  for (const size of [{ width: 296, height: 210 }, { width: 366, height: 406 }, { width: 704, height: 480 }]) {
    for (const root of [-5, 0, 1, 1.1, 3, 5]) {
      const { graph } = rootsFactorsLayout({ movingRoot: root }, size);
      const [fixed, moving] = graph.roots.markers;
      expect(fixed.positionLabel.position.y).toBe(fixed.center.y + 38);
      expect(fixed.labelBackground).toEqual({ x: fixed.center.x - 22, y: fixed.positionLabel.position.y - 15, width: 44, height: 20 });
      const plate = fixed.labelBackground!;
      expect(plate.x).toBeGreaterThanOrEqual(0);
      expect(plate.y).toBeGreaterThanOrEqual(0);
      expect(plate.x + plate.width).toBeLessThan(size.width);
      expect(plate.y + plate.height).toBeLessThan(size.height);
      expect(plate.width).toBeLessThan(moving.labelBackground!.width);
      expect(fixed.positionLabel.position.y).toBeGreaterThan(0);
      expect(fixed.positionLabel.position.y).toBeLessThan(size.height);
      expect(fixed.hitRegion).toBeNull();
      expect(fixed.haloRadius).toBeNull();
    }
  }
});

test("shorter fixed-domain graphs retain measurable initial and extreme minima", () => {
  for (const size of [{ width: 296, height: 210 }, { width: 336, height: 224 }, { width: 366, height: 244 }]) {
    for (const r of [3, -5]) {
      const math = createCard1Math(r);
      const { graph } = rootsFactorsLayout(math, size);
      const vertex = projectPoint(graph.plane.projection, card1Vertex(math));
      const axis = projectPoint(graph.plane.projection, { x: 0, y: 0 });
      expect(vertex.y - axis.y).toBeGreaterThanOrEqual(7.9);
      expect(vertex.y).toBeLessThan(graph.plane.projection.plot.y + graph.plane.projection.plot.height);
      expect(graph.curve.samples.find((sample) => sample.math.x === card1Vertex(math).x)?.position).toEqual(vertex);
    }
  }
});
