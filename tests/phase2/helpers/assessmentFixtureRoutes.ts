import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import type { CardRepository } from "../../../src/lib/cards/repository";
import type { Framework } from "../../../src/lib/frameworks/configuration";
import type { Page } from "@playwright/test";

// Test-only catalogue/auth substitution exercises the real handlers and Mongo.
// It adds no application route, config flag or permanent curriculum content.
export async function itemFixtureRoutes(page: Page, repo: CardRepository, actor: string, frameworks: Framework[]) {
  const bundle = await build({ stdin: { contents: `
    export { GET as history } from "@/app/api/items-data/[itemId]/history/route";
    export { GET as list, POST as add } from "@/app/api/items-data/[itemId]/tests/route";
    export { PATCH as edit, DELETE as remove } from "@/app/api/items-data/[itemId]/tests/[testId]/route";
    export { CardRepository } from "@/lib/cards/repository";
  `, resolveDir: process.cwd(), loader: "ts" }, bundle: true, platform: "node", format: "cjs", packages: "external", write: false,
  plugins: [{ name: "assessment-ui-fixtures", setup(builder) {
    builder.onLoad({ filter: /src\/lib\/auth\.ts$/ }, () => ({ contents: `export async function getCurrentUser() { return { id: ${JSON.stringify(actor)} }; }`, loader: "ts" }));
    builder.onLoad({ filter: /src\/lib\/frameworks\/configuration\.ts$/ }, async ({ path }) => {
      const contents = await readFile(path, "utf8"), empty = "const catalogue: readonly Framework[] = Object.freeze([]);";
      if (!contents.includes(empty)) throw new Error("Expected empty real Framework catalogue");
      return { contents: contents.replace(empty, `const catalogue: readonly Framework[] = ${JSON.stringify(frameworks)};`), loader: "ts" };
    });
  } }] });
  const fixture = { exports: {} };
  new Function("require", "module", "exports", bundle.outputFiles[0].text)(createRequire(resolve(process.cwd(), "package.json")), fixture, fixture.exports);
  type Handler = (request: Request, context: { params: Promise<{ itemId: string; testId?: string }> }) => Promise<Response>;
  const handlers = fixture.exports as Record<string, Handler> & { CardRepository: { application: () => Promise<CardRepository> } };
  handlers.CardRepository.application = async () => repo;
  await page.route("**/api/items-data/**", async (route) => {
    const request = route.request(), parts = new URL(request.url()).pathname.split("/");
    const itemId = decodeURIComponent(parts[3]), testId = parts[5] ? decodeURIComponent(parts[5]) : undefined;
    const key = request.method() === "POST" ? "add" : request.method() === "PATCH" ? "edit" : request.method() === "DELETE" ? "remove" : parts[4] === "history" ? "history" : "list";
    const response = await handlers[key](new Request(request.url(), { method: request.method(), headers: request.headers(), body: request.method() === "GET" ? undefined : request.postData() }), { params: Promise.resolve({ itemId, testId }) });
    await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() });
  });
}
