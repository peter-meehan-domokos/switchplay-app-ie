import { build, type Plugin } from "esbuild";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { once } from "node:events";
import { ObjectId } from "mongodb";
import { hashSync } from "bcryptjs";
import { randomUUID } from "node:crypto";
import type { CardRepository } from "../../src/lib/cards/repository";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import { initialCardData } from "../../src/lib/cards/domain";
import { createDefaultDeckContent } from "../../src/lib/cards/creatorDefaults";
import { createGroupExperienceIndexes } from "../../src/lib/groupExperiences/indexes";
import { GroupExperienceRepository } from "../../src/lib/groupExperiences/repository";
import { selectedContent } from "../../src/lib/groupExperiences/publicVersions";
import { personalLearningForUsers } from "../../src/lib/groupExperiences/learningReads";
import { groupProgressFixture, projectGroupProgressFixture, type GroupProgressPreview } from "../fixtures/groupProgress";

export async function seedGroupProgressReview(cards: CardRepository, uri: string, actor: string, other: string) {
  assertDisposableDatabase(uri, cards.db.databaseName);
  await createGroupExperienceIndexes(cards.db);
  const repo = new GroupExperienceRepository(cards), template = groupProgressFixture(), ids: string[] = [];
  for (const card of template.cards) {
    const root = await cards.createCardDraft(actor, card.content, "public");
    await cards.publishCard(actor, root.cardTemplateId, 0); ids.push(root.cardTemplateId);
  }
  const fixture = groupProgressFixture(ids), now = new Date();
  const people = ["Jack Murphy", "Emma Walsh", "Ben O'Connor"].map(username => ({ _id: new ObjectId(), username,
    email: `${randomUUID()}@example.invalid`, passwordHash: hashSync("local-test-only", 4), cardsData: [], decksData: [], createdAt: now, updatedAt: now }));
  await cards.users().insertMany(people);
  const followers = [other, ...people.map(person => person._id.toHexString())];
  const deck = await cards.createDeckDraft(actor, { ...createDefaultDeckContent([]), title: "Movement & Skills",
    cards: ids.map(cardTemplateId => ({ cardTemplateId })) }, "public");
  await cards.publishDeck(actor, deck.deckTemplateId, 0);
  const experience = await repo.create(actor, { name: fixture.name, operationId: randomUUID(), adminIds: [], followerIds: followers,
    manifest: { deckTemplateId: deck.deckTemplateId, deckVersion: 1, cards: ids.map(cardTemplateId => ({ cardTemplateId, version: 1 })) } });
  await repo.states().insertMany(fixture.cards.map(card => ({ experienceId: experience.experienceId, cardTemplateId: card.cardTemplateId,
    ...card.learning, revision: 0, createdAt: now, updatedAt: now })));
  for (const [follower, userId] of followers.entries()) {
    const rows = fixture.cards.map((card, i) => ({ ...initialCardData(card.cardTemplateId, 1, card.content, now), ...fixture.followerLearning[follower][i],
      // A real private sentinel makes projection/isolation checks meaningful.
      tests: [{ id: `PRIVATE-progress-test-${follower}-${i}`, date: "2026-10-31", result: true, createdAt: now }] }));
    await cards.users().updateOne({ _id: new ObjectId(userId) }, { $push: { cardsData: { $each: rows } } });
  }
  const projected = await repo.transaction(async session => {
    const { experience: current } = await repo.access(actor, experience.experienceId, "admin", session);
    const selected = await selectedContent(cards, current, session);
    const group = await repo.groupLearning(current.experienceId, selected.cards, session);
    const personal = await personalLearningForUsers(cards, followers, selected.cards, session);
    // Real explicit-version Group/personal readers supply only learning. Mock
    // assessments remain the separate static fixture, never database test lists.
    return projectGroupProgressFixture(fixture, group, followers.map(id => personal.get(id)!));
  });
  const data: GroupProgressPreview = { ...projected, actor, name: fixture.name, experienceId: experience.experienceId };
  return { data, fixture, deckId: deck.deckTemplateId, followers };
}

async function previewBundle() {
  const adapter = resolve("tests/fixtures/groupProgressAdapter.ts");
  const plugin: Plugin = { name: "group-progress-preview-only", setup(builder) {
    builder.onResolve({ filter: /^preview-original:/ }, args => ({ path: args.path.slice("preview-original:".length), namespace: "preview-original" }));
    builder.onLoad({ filter: /.*/, namespace: "preview-original" }, async args => ({ contents: await readFile(args.path, "utf8"), loader: "ts", resolveDir: dirname(args.path) }));
    builder.onLoad({ filter: /src\/lib\/frameworks\/progressClient\.ts$/, namespace: "file" }, args => ({ loader: "ts", contents: `
      export { readAreaExpansion, writeAreaExpansion } from ${JSON.stringify(`preview-original:${args.path}`)};
      export { readProgressMetadata, readProgressSummary } from ${JSON.stringify(adapter)};
    ` }));
    builder.onLoad({ filter: /src\/components\/assessments\/useAssessmentHistory\.ts$/, namespace: "file" }, () => ({ loader: "ts",
      contents: `export { useAssessmentHistory } from ${JSON.stringify(adapter)};` }));
  } };
  return build({ entryPoints: ["tests/fixtures/groupProgressHarness.tsx"], bundle: true, write: false, outdir: "preview-bundle", platform: "browser",
    format: "iife", jsx: "automatic", tsconfig: "tsconfig.json",
    // Next normally substitutes these build-time flags. This standalone test
    // bundle supplies an empty environment, never the machine's real values.
    define: { "process.env.NODE_ENV": '"development"', "process.env": "{}" }, plugins: [plugin] });
}

export async function startGroupProgressPreview(data: GroupProgressPreview, styleBaseURL: string, host = "127.0.0.1", port = 0) {
  // Only local, disposable application assets may be reused. No environment
  // database URI is read and this server never proxies application APIs.
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(styleBaseURL)) throw Error("A local fixture styling server is required");
  const bundle = await previewBundle();
  const page = await (await fetch(`${styleBaseURL}/login`)).text();
  const styles = [...page.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)].map(match => match[0]).join("");
  if (!styles) throw Error("Could not load the existing app's global stylesheet");
  const json = JSON.stringify(data).replaceAll("<", "\\u003c");
  const server = createServer(async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    const url = new URL(request.url ?? "/", "http://fixture.invalid");
    if (url.pathname === "/__group-progress-preview") {
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.end(`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Fixture-only Group Progress</title>${styles}<link rel="stylesheet" href="/__preview.css"></head><body><div id="fixture"></div><script>window.groupProgressPreview=${json}</script><script src="/__preview.js"></script></body></html>`); return;
    }
    if (url.pathname === "/__preview.js" || url.pathname === "/__preview.css") {
      const file = bundle.outputFiles.find(file => file.path.endsWith(url.pathname.endsWith(".js") ? ".js" : ".css"));
      response.setHeader("Content-Type", url.pathname.endsWith(".js") ? "application/javascript" : "text/css"); response.end(file?.contents); return;
    }
    if (request.method === "GET" && url.pathname.startsWith("/_next/static/") && !url.pathname.includes("..")) {
      try { const asset = await fetch(new URL(url.pathname + url.search, styleBaseURL));
        response.statusCode = asset.status; response.setHeader("Content-Type", asset.headers.get("Content-Type") ?? "application/octet-stream");
        response.end(Buffer.from(await asset.arrayBuffer()));
      } catch { response.statusCode = 502; response.end("Fixture stylesheet unavailable"); }
      return;
    }
    // Destination navigation/editing are not implemented by 5.0. In particular,
    // a click can never fall through to a personal history or mutation endpoint.
    response.statusCode = 404; response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ error: "This fixture previews Group values and read-only history only; destinations and editing remain deferred." }));
  });
  server.listen(port, host); await once(server, "listening");
  const address = server.address(); if (!address || typeof address === "string") throw Error("Missing preview port");
  return { server, port: address.port, baseURL: `http://127.0.0.1:${address.port}` };
}
