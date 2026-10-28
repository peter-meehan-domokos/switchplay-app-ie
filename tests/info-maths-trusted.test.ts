import assert from "node:assert/strict";
import { test, mock } from "node:test";
import { chromium } from "playwright-core";
import type { Browser, Route } from "playwright-core";
import { trustedInfoMaths } from "../src/lib/infoCards/trustedMaths";
import { InfoMathsError } from "../src/lib/infoCards/mathsValidation";

const draft = { title: "Maths", body: "$x$", bodyFormat: "latex-v1" as const, seriesId: "s", mediaItem: null };

test("trusted navigation restricts both credentials to the host/static paths and never follows redirects", async () => {
  const saved = { ...process.env };
  const errors: unknown[][] = [];
  mock.method(console, "error", (...args: unknown[]) => errors.push(args));
  process.env.SESSION_SECRET = "test-only-host-signing-secret";
  process.env.VERCEL_AUTOMATION_BYPASS_SECRET = "test-only-bypass";
  delete process.env.VERCEL;
  let handler: (route: Route) => Promise<unknown>;
  let status = 200, closed = 0, fulfilled = 0, fetched = 0, aborted = 0;
  let fetchError = false;
  const response = { status: () => status };
  const request = (url: string) => ({
    request: () => ({ url: () => url, headers: () => ({}) }),
    fetch: async (options: { headers: Record<string, string>; maxRedirects: number }) => {
      fetched++;
      if (fetchError) throw new Error("route.fetch cancelled: test-only-bypass");
      assert.equal(options.maxRedirects, 0);
      assert.equal(options.headers["x-vercel-protection-bypass"], "test-only-bypass");
      assert.match(options.headers["x-info-maths-host"], /^\d+\.[0-9a-f]{64}$/);
      return response;
    },
    fulfill: async () => { fulfilled++; },
    abort: async () => { aborted++; },
  }) as unknown as Route;
  const page = {
    setDefaultTimeout() {}, on() {}, url: () => "http://127.0.0.1:43210/internal/info-maths",
    goto: async () => {
      await handler(request(page.url()));
      if (status !== 200) throw new Error("Navigation aborted");
      return response;
    },
    waitForFunction: async () => ({ jsonValue: async () => ({ result: { status: "measurement-unavailable", reason: "FONT_LOAD_FAILED", generation: 1, diagnostics: [] }, safe: false, headerFits: false }), dispose: async () => {} }),
    evaluate: async (_fn: unknown, arg?: unknown) => arg ? undefined : {
      result: { status: "measurement-unavailable", reason: "FONT_LOAD_FAILED", generation: 1, diagnostics: [] }, safe: false, headerFits: false,
    },
  };
  mock.method(chromium, "launch", async (options: { env: Record<string, string> }) => {
    assert(!("SESSION_SECRET" in options.env));
    assert(!("VERCEL_AUTOMATION_BYPASS_SECRET" in options.env));
    return {
      newContext: async () => ({ grantPermissions: async () => {}, route: async (_pattern: string, fn: typeof handler) => { handler = fn; }, newPage: async () => page }),
      close: async () => { closed++; },
    } as unknown as Browser;
  });
  try {
    const validate = trustedInfoMaths("http://127.0.0.1:43210");
    assert.equal((await validate(draft, "Basics")).result.status, "measurement-unavailable");
    assert(closed > 0); assert.equal(fulfilled, 1);
    await handler!(request("http://127.0.0.1:43210/_next/static/font.woff2"));
    const before = fetched;
    for (const url of ["https://vercel.com/login", "http://127.0.0.1:43210/api/auth/me", "http://127.0.0.1:43210/other"]) await handler!(request(url));
    assert.equal(fetched, before); assert.equal(aborted, 3);
    for (status of [302, 307, 401, 403]) {
      await assert.rejects(validate(draft, "Basics"), (error: unknown) => error instanceof InfoMathsError && error.failure === "authentication");
    }
    status = 200;
    assert.equal((await validate(draft, "Basics")).safe, false); // Failure cleanup permits retry; unavailable never fits.
    fetchError = true;
    await assert.doesNotReject(handler!(request("http://127.0.0.1:43210/_next/static/font.woff2")));
    const logs = JSON.stringify(errors);
    assert(!logs.includes(process.env.VERCEL_AUTOMATION_BYPASS_SECRET!));
    assert(!logs.includes(process.env.SESSION_SECRET!));
  } finally {
    mock.restoreAll();
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});

test("a protected Preview without its bypass fails before launching Chromium", async () => {
  const saved = { ...process.env };
  let launched = false;
  mock.method(chromium, "launch", async () => { launched = true; throw new Error("Should not launch"); });
  mock.method(console, "error", () => {});
  Object.assign(process.env, { VERCEL: "1", VERCEL_ENV: "preview", VERCEL_URL: "example.vercel.app" });
  delete process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  try {
    await assert.rejects(trustedInfoMaths("https://example.vercel.app")(draft, "Basics"), (error: unknown) => error instanceof InfoMathsError && error.failure === "authentication");
    assert.equal(launched, false);
  } finally {
    mock.restoreAll();
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});


test("browser startup failures return a controlled category without leaking exception text", async () => {
  const saved = { ...process.env }, logs: unknown[][] = [];
  delete process.env.VERCEL;
  mock.method(console, "error", (...args: unknown[]) => logs.push(args));
  mock.method(chromium, "launch", async () => { throw new Error("test-only-sensitive-startup-detail"); });
  try {
    await assert.rejects(trustedInfoMaths("http://127.0.0.1:43210")(draft, "Basics"), (error: unknown) => error instanceof InfoMathsError && error.failure === "browser-startup");
    assert(!JSON.stringify(logs).includes("test-only-sensitive-startup-detail"));
  } finally {
    mock.restoreAll();
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});
