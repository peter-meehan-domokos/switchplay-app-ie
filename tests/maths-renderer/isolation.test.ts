import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

test("KaTeX stylesheet is exactly the pinned upstream CSS with scoped selectors and package font URLs", () => {
  const original = readFileSync("node_modules/katex/dist/katex.css", "utf8");
  const expected = original.replace(/^\.katex/gm, ".switchplay-maths-katex .katex")
    .replace(/^body \{/gm, ".switchplay-maths-katex {")
    .replaceAll("url(fonts/", "url(katex/dist/fonts/");
  const actual = readFileSync("src/components/maths-renderer/katex.scoped.css", "utf8");
  assert.equal(actual.slice(actual.indexOf("/* stylelint")), expected);
  assert.equal(readFileSync("src/components/maths-renderer/katex.LICENSE.txt", "utf8"), readFileSync("node_modules/katex/LICENSE", "utf8"));
});

test("renderer and development fixtures import only their own modules, React, KaTeX and Next's route guard", () => {
  for (const directory of ["src/components/maths-renderer", "src/app/dev/maths-renderer"]) {
    for (const file of readdirSync(directory).filter(name => /\.tsx?$/.test(name))) {
      const source = readFileSync(join(directory, file), "utf8");
      for (const [, dependency] of source.matchAll(/(?:from\s+|import\s+)["']([^"']+)["']/g)) {
        assert(dependency.startsWith("./") || ["react", "katex", "next/navigation", "@/components/maths-renderer/MathsExpression", "@/components/maths-renderer/MathsRenderer", "@/components/maths-renderer/types"].includes(dependency)
          || (directory === "src/app/dev/maths-renderer" && dependency === "react-dom/client"), `${file}: ${dependency}`);
      }
    }
  }
});
