import { expect, test } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const feature = fileURLToPath(new URL("..", import.meta.url));
const sourceFiles = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  if (entry.name.startsWith(".")) return [];
  const path = resolve(directory, entry.name);
  return entry.isDirectory() ? sourceFiles(path) : /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
});

test("all feature imports remain local or use permitted framework, D3 and test packages", () => {
  for (const path of sourceFiles(feature)) {
    const source = readFileSync(path, "utf8");
    for (const match of source.matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/g)) {
      const target = match[1];
      if (target.startsWith(".")) {
        expect(relative(feature, resolve(dirname(path), target)).startsWith("..")).toBe(false);
      } else {
        expect(target).toMatch(/^(react|next|d3-(array|scale|shape)|@playwright\/test|node:[\w/]+)$/);
      }
    }
  }
});

test("portable mathematics and layouts contain no framework imports or browser types", () => {
  const paths = [...sourceFiles(resolve(feature, "core")), ...["model", "rootsFactorsLayout", "presentationLayouts", "manipulation", "learning", "learningRecords", "recordedLearning"].map((name) => resolve(feature, `activities/roots-factors/${name}.ts`))];
  for (const path of paths) {
    const source = readFileSync(path, "utf8");
    expect(source).not.toMatch(/from\s+["'](?:react|next)|\b(?:window|document|HTMLElement|SVGElement|PointerEvent|ResizeObserver)\b/);
  }
});

test("reusable activity and web renderers have no imports from the lab", () => {
  for (const path of [...sourceFiles(resolve(feature, "activities")), ...sourceFiles(resolve(feature, "platform")), ...sourceFiles(resolve(feature, "sparklines"))]) {
    expect(readFileSync(path, "utf8")).not.toMatch(/from\s+["'][^"']*\/lab\//);
  }
});
