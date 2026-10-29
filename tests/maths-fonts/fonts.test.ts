import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";

const directory = "src/app/dev/maths-fonts";
test("every open font is unmodified, from pinned official upstream and accompanied by its licence", () => {
  const sources = JSON.parse(readFileSync(`${directory}/fonts/sources.json`, "utf8"));
  assert.equal(sources.files.filter((file: { file: string }) => file.file.endsWith(".ttf")).length, 14);
  for (const file of sources.files) {
    assert(/^https:\/\/(raw\.githubusercontent\.com\/(google\/fonts|googlefonts\/tinos|liberationfonts\/liberation-fonts)\/|github\.com\/liberationfonts\/liberation-fonts\/files\/)/.test(file.url));
    assert.equal(createHash("sha256").update(readFileSync(`${directory}/fonts/${file.file}`)).digest("hex"), file.sha256);
  }
  for (const file of ["Arimo-OFL.txt", "Tinos-OFL.txt", "Liberation-LICENSE.txt"]) assert(readFileSync(`${directory}/fonts/${file}`, "utf8").includes("SIL OPEN FONT LICENSE Version 1.1"));
  assert(!readdirSync(`${directory}/fonts`).some(file => /arial|times/i.test(file)));
});

test("font review is guarded and depends only on its fixtures and the standalone renderer", () => {
  const page = readFileSync(`${directory}/page.tsx`, "utf8");
  assert(page.indexOf('process.env.NODE_ENV !== "development"') < page.indexOf("return <FontReview"));
  const source = readFileSync(`${directory}/FontReview.tsx`, "utf8");
  const imports = [...source.matchAll(/from\s+"([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(imports.sort(), ["react", "@/components/maths-renderer/MathsRenderer", "@/components/maths-renderer/types", "../maths-renderer/ExplanationReviewFixtures", "./review.module.css"].sort());
  assert(!source.includes("info-cards/") && !source.includes("measureInfoCapacity"));
});
