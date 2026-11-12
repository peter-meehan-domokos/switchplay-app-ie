import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";

// The real AuthScreen is bundled. Only its four collaborators are replaced by recorders, so the test
// establishes what one successful sign-in invokes: the Group Experience branch needs a fresh client
// authority scope and the login perspective; main needs the visual guest handoff. The recorders only
// show that each collaborator was INVOKED with the expected arguments; the real handoff, session and
// perspective modules are not run here. Only the synchronous prefix (client scope, then Group login
// perspective) is ordered; the handoff, refresh and navigation are asserted as a set. A rejected
// sign-in invokes none of them.
let bundle: string;
test.beforeAll(async () => {
  const replacements: Record<string, string> = {
    "next/navigation": `export const useRouter = () => ({ replace: (to) => (window.__calls = [...(window.__calls || []), ['replace', to]]), refresh: () => (window.__calls = [...(window.__calls || []), ['refresh']]) });`,
    "@/lib/cards/workingCardStore": `export const workingCardStore = { clearSession: () => (window.__calls = [...(window.__calls || []), ['clearSession']]) };`,
    "@/lib/groupExperiences/loginPerspective": `export const startGroupLogin = (id) => (window.__calls = [...(window.__calls || []), ['startGroupLogin', id]]);`,
    "@/lib/visualLearningRecords/loginHandoff": `export const startVisualGuestLoginHandoff = (id, guest) => (window.__calls = [...(window.__calls || []), ['visualHandoff', id, guest]]);`,
  };
  const compiled = await build({
    stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
      import React from 'react'; import { createRoot } from 'react-dom/client';
      import AuthScreen from './src/components/auth/AuthScreen';
      createRoot(document.getElementById('root')).render(<AuthScreen redirectTo={location.search.includes('redirect') ? '/decks' : undefined} />);
    ` },
    bundle: true, write: false, outfile: "fixture.js", platform: "browser", format: "iife", jsx: "automatic",
    define: { "process.env.NODE_ENV": JSON.stringify("test"), "process.env": "{}" },
    loader: { ".ttf": "dataurl", ".woff": "dataurl", ".woff2": "dataurl" },
    plugins: [{ name: "auth-collaborators", setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => args.path in replacements ? { path: args.path, namespace: "auth-fixture" } : undefined);
      builder.onLoad({ filter: /.*/, namespace: "auth-fixture" }, args => ({ loader: "js", contents: replacements[args.path] }));
    } }],
  });
  bundle = compiled.outputFiles!.find(file => file.path.endsWith(".js"))!.text;
});

async function mount(page: Page, login: { status: number; body: unknown }, requests: string[], query = "") {
  await page.route("**/fixture.html*", route => route.fulfill({ contentType: "text/html", body: '<div id="root"></div><script src="/fixture.js"></script>' }));
  await page.route("**/fixture.js", route => route.fulfill({ contentType: "text/javascript", body: bundle }));
  await page.route("**/api/auth/login", route => {
    requests.push(route.request().postData() ?? "");
    return route.fulfill({ status: login.status, contentType: "application/json", body: JSON.stringify(login.body) });
  });
  await page.goto(`http://localhost:3000/fixture.html${query}`);
}
async function signIn(page: Page) {
  await page.getByLabel("Username or email").fill("alice");
  await page.getByLabel("Password").fill("local-test-only");
  await page.getByRole("button", { name: "Sign in" }).click();
}
const calls = (page: Page) => page.evaluate(() => (window as unknown as { __calls?: unknown[][] }).__calls ?? []);
// The visual handoff is deliberately asynchronous and independent of the navigation that follows, so only
// the synchronous prefix (client scope, then Group perspective) has a fixed order; the rest is a set.
const afterPrefix = async (page: Page, prefix: unknown[][], rest: unknown[][]) => {
  await expect.poll(async () => (await calls(page)).length).toBe(prefix.length + rest.length);
  const all = await calls(page);
  expect(all.slice(0, prefix.length)).toEqual(prefix);
  expect(all.slice(prefix.length).map(call => JSON.stringify(call)).sort()).toEqual(rest.map(call => JSON.stringify(call)).sort());
};

test("one successful sign-in clears the client scope, starts the Group login perspective and invokes the guest-handoff collaborator", async ({ page }) => {
  const requests: string[] = [], guest = { guestId: "guest-1", token: "opaque" };
  await mount(page, { status: 200, body: { user: { id: "user-1" }, visualGuest: guest } }, requests);
  await signIn(page);
  await afterPrefix(page, [["clearSession"], ["startGroupLogin", "user-1"]], [["visualHandoff", "user-1", guest], ["refresh"]]);
  expect(requests).toHaveLength(1);
});

test("a sign-in without a visual guest does not start a handoff but still starts the Group perspective", async ({ page }) => {
  await mount(page, { status: 200, body: { user: { id: "user-2" } } }, []);
  await signIn(page);
  await afterPrefix(page, [["clearSession"], ["startGroupLogin", "user-2"]], [["refresh"]]);
});

test("a pre-login return target is honoured, alongside the Group perspective start and the guest-handoff invocation", async ({ page }) => {
  await mount(page, { status: 200, body: { user: { id: "user-3" }, visualGuest: { guestId: "g" } } }, [], "?redirect=1");
  await signIn(page);
  await afterPrefix(page, [["clearSession"], ["startGroupLogin", "user-3"]], [["visualHandoff", "user-3", { guestId: "g" }], ["replace", "/decks"]]);
});

test("a rejected sign-in starts nothing and shows the support error", async ({ page }) => {
  await mount(page, { status: 401, body: { code: "INVALID_CREDENTIALS" } }, []);
  await signIn(page);
  await expect(page.locator(".auth-error")).toBeVisible();
  expect(await calls(page)).toEqual([]);
});
