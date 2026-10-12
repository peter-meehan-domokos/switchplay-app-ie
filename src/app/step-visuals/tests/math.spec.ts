import { expect, test } from "@playwright/test";
import { card1Factors, card1Vertex, createCard1Math, evaluateCard1, initialMath } from "../activities/roots-factors/model";
import { evaluateFactor, formatFactor, formatNumber } from "../core/math/realFactors";

for (let r = -5; r <= 5; r++) {
  test(`Card 1 invariants at r = ${r}`, () => {
    const math = createCard1Math(r);
    const factors = card1Factors(math);
    const vertex = card1Vertex(math);
    expect(factors).toEqual([{ id: "fixed-root", root: 1 }, { id: "moving-root", root: r }]);
    expect(evaluateCard1(math, 1)).toBe(0);
    expect(evaluateCard1(math, r)).toBe(0);
    expect(vertex.x).toBe((1 + r) / 2);
    expect(vertex.y).toBeCloseTo(-((r - 1) ** 2) / 4, 12);
    expect(evaluateCard1(math, vertex.x)).toBe(vertex.y);
    for (const offset of [0.25, 1, 3]) {
      expect(evaluateCard1(math, vertex.x - offset)).toBeCloseTo(evaluateCard1(math, vertex.x + offset), 12);
      expect(evaluateCard1(math, vertex.x + offset)).toBeGreaterThan(vertex.y);
    }
    for (const x of [-6, -2.5, 0, 2.75, 6]) expect(evaluateCard1(math, x)).toBeCloseTo(x * x - (1 + r) * x + r, 12);
    expect(Object.isFrozen(math)).toBe(true);
    expect(Object.isFrozen(factors[0])).toBe(true);
  });
}

test("initial model, sign formatting, zero normalisation and factor substitution", () => {
  expect(initialMath).toEqual({ movingRoot: 3 });
  expect(card1Vertex(initialMath)).toEqual({ x: 2, y: -1 });
  expect(formatFactor({ id: "a", root: 3 })).toBe("(x − 3)");
  expect(formatFactor({ id: "a", root: -3 })).toBe("(x + 3)");
  expect(formatFactor({ id: "a", root: -0 })).toBe("(x)");
  expect(formatNumber(-0)).toBe("0");
  expect(Object.is(createCard1Math(-0).movingRoot, -0)).toBe(false);
  expect(evaluateFactor({ id: "a", root: -3 }, -3)).toBe(0);
  expect(evaluateFactor({ id: "a", root: 3 }, -3)).toBe(-6);
});

test("coincident roots retain two identities and two explicit factors", () => {
  const factors = card1Factors(createCard1Math(1));
  expect(factors).toHaveLength(2);
  expect(factors.map(formatFactor)).toEqual(["(x − 1)", "(x − 1)"]);
  expect(card1Vertex(createCard1Math(1))).toEqual({ x: 1, y: 0 });
});

test("rejects invalid roots, nonfinite mathematics and overflow", () => {
  for (const value of [NaN, Infinity, -Infinity, -6, 6, 1.5]) expect(() => createCard1Math(value)).toThrow(RangeError);
  for (const value of [NaN, Infinity, -Infinity]) {
    expect(() => evaluateCard1(initialMath, value)).toThrow(RangeError);
    expect(() => formatFactor({ id: "a", root: value })).toThrow(RangeError);
  }
  expect(() => evaluateCard1(initialMath, Number.MAX_VALUE)).toThrow(RangeError);
});
