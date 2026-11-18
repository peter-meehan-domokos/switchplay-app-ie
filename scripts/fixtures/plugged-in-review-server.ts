import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";

/** Only instantiated by the disposable CLI runner. There is no app auth bypass
 * or production route: this local gateway uses the ordinary login API. */
export async function createVisualReviewServer(options: {
  appOrigin: string; appPort: number; hosts: readonly string[]; actor: string; entryPath: string; deckPath: string;
}) {
  const files = new Map([
    ["/review-media/sample.mp4", { bytes: await readFile("tests/fixtures/info-cards-sample.mp4"), type: "video/mp4" }],
    ["/assets/fixtures/roots.png", { bytes: await readFile("public/interactive-visuals/roots-and-factors-v1.png"), type: "image/png" }],
    ["/assets/fixtures/area.png", { bytes: await readFile("public/interactive-visuals/integration-area-v2.png"), type: "image/png" }],
  ]);
  return async (request: IncomingMessage, response: ServerResponse): Promise<boolean> => {
    const path = request.url?.split("?")[0] ?? "/";
    if (path.startsWith("/review/")) {
      response.setHeader("Cache-Control", "private, no-store"); response.setHeader("Referrer-Policy", "no-referrer");
      let hostname: string;
      try { hostname = new URL(`http://${request.headers.host}`).hostname; } catch { response.writeHead(400).end(); return true; }
      if (path !== options.entryPath || request.method !== "GET" || !options.hosts.includes(hostname)) { response.writeHead(404).end(); return true; }
      try {
        const login = await fetch(`${options.appOrigin}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: "phase2", password: "local-test-only" }), signal: AbortSignal.timeout(30_000) });
        const body = await login.json();
        const cookie = login.headers.getSetCookie().filter(value => value.startsWith("switchplay_session="));
        if (!login.ok || body.user?.id !== options.actor || cookie.length !== 1) throw new Error("Fixture login unavailable");
        response.setHeader("Set-Cookie", cookie);
        response.writeHead(303, { Location: `http://${hostname}:${options.appPort}${options.deckPath}` }).end();
      } catch { response.writeHead(503, { "Content-Type": "text/plain" }).end("Review login is not ready. Reload this link in a moment."); }
      return true;
    }
    const file = files.get(path); if (!file) return false;
    if (request.method !== "GET" && request.method !== "HEAD") { response.writeHead(405).end(); return true; }
    response.setHeader("Content-Type", file.type); response.setHeader("Accept-Ranges", "bytes");
    response.setHeader("Cache-Control", "public, max-age=3600");
    const range = request.headers.range;
    if (range) {
      const match = range.match(/^bytes=(\d+)-(\d*)$/), start = Number(match?.[1]), end = Math.min(match?.[2] ? Number(match[2]) : file.bytes.length - 1, file.bytes.length - 1);
      if (!match || !Number.isSafeInteger(start) || start < 0 || start > end) { response.writeHead(416, { "Content-Range": `bytes */${file.bytes.length}` }).end(); return true; }
      response.writeHead(206, { "Content-Length": end - start + 1, "Content-Range": `bytes ${start}-${end}/${file.bytes.length}` });
      response.end(request.method === "HEAD" ? undefined : file.bytes.subarray(start, end + 1));
    } else {
      response.writeHead(200, { "Content-Length": file.bytes.length }); response.end(request.method === "HEAD" ? undefined : file.bytes);
    }
    return true;
  };
}
