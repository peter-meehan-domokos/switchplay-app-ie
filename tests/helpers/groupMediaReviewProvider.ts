// Bundler-only provider substitution for the disposable phone/browser harness.
// No production module imports this file, and no provider request leaves loopback.
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import type { GroupMediaProvider } from "../../src/lib/groupExperiences/media/model";
export function reviewMediaOrigin() {
  assertDisposableDatabase();
  const origin = process.env.PHASE2_MEDIA_FIXTURE_ORIGIN ?? "";
  if (process.env.PHASE2_MEDIA_REVIEW !== "1" || !/^switchplay_phase2_browser_/.test(process.env.MONGODB_DB ?? "") || !/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) throw Error("Invalid disposable media review configuration");
  return origin;
}
export const productionGroupMediaProvider: GroupMediaProvider = {
  checkConfiguration() { reviewMediaOrigin(); },
  async allocate(row) {
    const response = await fetch(`${reviewMediaOrigin()}/group/allocate`, { method: "POST", body: JSON.stringify(row) });
    if (!response.ok) throw Error("Fixture allocation failed");
    const asset = await response.json();
    return { asset, uploadURL: `/__phase7-media/upload/${row.contributionId}`, headers: { "Content-Type": row.contentType }, expiresAt: new Date(Date.now() + 300000) };
  },
  async status(row) {
    const response = await fetch(`${reviewMediaOrigin()}/group/status`, { method: "POST", body: JSON.stringify(row) });
    if (!response.ok) throw Error("Fixture metadata mismatch");
    return response.json();
  },
  async remove(row) { const r = await fetch(`${reviewMediaOrigin()}/group/remove/${row.contributionId}`, { method: "DELETE" }); if (!r.ok) throw Error("Fixture deletion failed"); },
  async deliver(row, action, signal) {
    if (row.kind === "video") throw Error("This review fixture has no live Stream provider");
    const response = await fetch(`${reviewMediaOrigin()}/assets/${row.contributionId}`, { signal });
    return new Response(response.body, { status: response.status, headers: { "Content-Type": response.headers.get("content-type") ?? "image/png", "Cache-Control": "private, no-store", ...(action === "playback" ? {} : { "Content-Disposition": 'attachment; filename="training.png"' }) } });
  },
};
