import { build } from "esbuild";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import type { CardRepository } from "../../../src/lib/cards/repository";
import type { Framework } from "../../../src/lib/frameworks/configurationContracts";
import type { Page } from "@playwright/test";
import { frameworkCataloguePlugin } from "../../helpers/frameworkCataloguePlugin";

// Actual handlers and disposable Mongo, with only the catalogue replaced.
// Request auth follows the real cookie through auth/me, isolated per request.
export async function groupProgressRoutes(page: Page, repo: CardRepository, frameworks: Framework[]) {
  const bundle = await build({ stdin: { contents: `
    export { GET as metadata } from "@/app/api/frameworks/route";
    export { GET as personal } from "@/app/api/frameworks/[frameworkId]/summary/route";
    export { GET as navigation } from "@/app/api/group-experiences/[experienceId]/progress-navigation/route";
    export { GET as summary } from "@/app/api/group-experiences/[experienceId]/frameworks/[frameworkId]/summary/route";
    export { GET as destinations } from "@/app/api/group-experiences/[experienceId]/frameworks/[frameworkId]/destinations/route";
    export { GET as itemHistory } from "@/app/api/group-experiences/[experienceId]/frameworks/[frameworkId]/items/[frameworkItemId]/history/route";
    export { GET as cardHistory } from "@/app/api/group-experiences/[experienceId]/frameworks/[frameworkId]/cards/[cardTemplateId]/history/route";
    export { CardRepository } from "@/lib/cards/repository";
    export { withActor } from "@/lib/auth";
  `, resolveDir: process.cwd(), loader: "ts" }, bundle: true, platform: "node", format: "cjs", packages: "external", write: false,
  plugins: [{ name: "request-fixture-auth", setup(builder) { builder.onLoad({ filter: /src\/lib\/auth\.ts$/ }, () => ({ loader: "ts", contents: `
    import { AsyncLocalStorage } from "node:async_hooks";
    const context = new AsyncLocalStorage();
    export const withActor = (actor, run) => context.run(actor, run);
    export async function getCurrentUser() { return context.getStore(); }
  ` })); } }, frameworkCataloguePlugin(frameworks)] });
  const fixture = { exports: {} }; new Function("require", "module", "exports", bundle.outputFiles[0].text)(createRequire(resolve("package.json")), fixture, fixture.exports);
  type Handler = (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>;
  const api = fixture.exports as Record<string, Handler> & { CardRepository: { application: () => Promise<CardRepository> }; withActor: (actor: unknown, run: () => Promise<Response>) => Promise<Response> };
  api.CardRepository.application = async () => repo;
  const dispatch = async (request: import("@playwright/test").Request, key: string, params: Record<string, string>) => {
    const user = (await (await page.request.get("/api/auth/me")).json()).user;
    return api.withActor(user, () => api[key](new Request(request.url(), { method: request.method(), headers: request.headers(), body: request.method() === "GET" ? undefined : request.postData() }), { params: Promise.resolve(params) }));
  };
  await page.route("**/api/frameworks{,/**}", async route => {
    const parts = new URL(route.request().url()).pathname.split("/");
    if (parts[4] && parts[4] !== "summary") return route.continue();
    const response = await dispatch(route.request(), parts[3] ? "personal" : "metadata", { frameworkId: parts[3] ?? "" });
    await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() });
  });
  await page.route("**/api/group-experiences/**", async route => {
    const parts = new URL(route.request().url()).pathname.split("/");
    const key = parts[4] === "progress-navigation" ? "navigation" : parts[4] !== "frameworks" ? undefined
      : parts[6] === "summary" ? "summary" : parts[6] === "destinations" ? "destinations" : parts[6] === "items" ? "itemHistory" : parts[6] === "cards" ? "cardHistory" : undefined;
    if (!key) return route.continue();
    const response = await dispatch(route.request(), key, { experienceId: parts[3], frameworkId: parts[5], frameworkItemId: parts[7], cardTemplateId: parts[7] });
    await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() });
  });
}
