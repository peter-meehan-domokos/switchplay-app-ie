import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import ts from "typescript";

test("KaTeX stylesheet is exactly the pinned upstream CSS with scoped selectors and package font URLs", () => {
  const original = readFileSync("node_modules/katex/dist/katex.css", "utf8");
  const expected = original.replace(/^\.katex/gm, ".switchplay-maths-katex .katex")
    .replace(/^body \{/gm, ".switchplay-maths-katex {")
    .replaceAll("url(fonts/", "url(../../../node_modules/katex/dist/fonts/");
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

test("the complete local import graph cannot escape renderer and development ownership", () => {
  const renderer = resolve("src/components/maths-renderer"), development = resolve("src/app/dev/maths-renderer");
  const visited = new Set<string>();
  function visit(file: string) {
    if (visited.has(file)) return;
    visited.add(file);
    if (!/\.tsx?$/.test(file)) return;
    const inDevelopment = file.startsWith(development + sep);
    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    const dependencies = new Set<string>();
    function scan(node: ts.Node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) dependencies.add(node.moduleSpecifier.text);
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === "require"))) {
        assert(node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0]), `${file}: nonliteral module dependency`);
        dependencies.add((node.arguments[0] as ts.StringLiteral).text);
      }
      ts.forEachChild(node, scan);
    }
    scan(source);
    for (const dependency of dependencies) {
      if (!dependency.startsWith(".") && !dependency.startsWith("@/")) {
        assert(["react", "katex", ...(inDevelopment ? ["next/navigation", "react-dom/client"] : [])].includes(dependency), `${file}: ${dependency}`);
        continue;
      }
      const target = dependency.startsWith("@/") ? resolve("src", dependency.slice(2)) : resolve(dirname(file), dependency);
      assert(target.startsWith(renderer + sep) || (inDevelopment && target.startsWith(development + sep)), `${file}: dependency escapes ownership: ${dependency}`);
      const resolved = [target, `${target}.ts`, `${target}.tsx`, join(target, "index.ts"), join(target, "index.tsx")].find(candidate => existsSync(candidate) && statSync(candidate).isFile());
      assert(resolved, `${file}: unresolved dependency ${dependency}`);
      visit(resolved);
    }
  }
  for (const root of [renderer, development]) for (const file of readdirSync(root).filter(name => /\.tsx?$/.test(name))) visit(join(root, file));
});
