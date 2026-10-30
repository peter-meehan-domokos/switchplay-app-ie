import { CardRepository } from "./cards/repository";
import { CardArchitectureError, requireCondition } from "./cards/domain";
import { assertDeckVersionAccess } from "./cards/versionAccess";
import { instructionalImageBytes } from "./cards/mediaProviders";
import { assertNotInfoMedia } from "./infoCards/mediaRegistry";
import { stepMediaItems } from "./stepMedia";
import { readInstructionalImageContext, type InstructionalImageContext } from "./instructionalImageContext";
import { createVisualRequestBudget } from "./visualLearningRecords/requestBudget";
import type { ImageMediaItem } from "./media";

export const MAX_INSTRUCTIONAL_IMAGE_BYTES = 10 * 1024 * 1024;
/** Exact immutable lookup; never the broad protected-media asset scan. */
export async function resolveInstructionalImage(repo: CardRepository, actor: string, context: InstructionalImageContext): Promise<ImageMediaItem> {
  requireCondition(actor === context.viewerUserId, "INSTRUCTIONAL_IMAGE_FORBIDDEN");
  return repo.transaction(async session => {
    const version = await repo.consultationCardVersion(actor, context.cardTemplateId,
      { mode: context.mode, version: context.version, ...(context.mode === "working" ? { deckTemplateId: context.deckTemplateId } : {}) }, session);
    if (context.mode === "working") {
      const user = await repo.getPersonalUser(actor, session);
      requireCondition(user?.decksData.some(deck => deck.deckTemplateId === context.deckTemplateId && deck.deckTemplateVersion === context.deckVersion), "INSTRUCTIONAL_IMAGE_VERSION_CONFLICT");
    } else {
      const root = await repo.decks().findOne({ deckTemplateId: context.deckTemplateId }, { session });
      const deck = await repo.getDeckVersion(context.deckTemplateId, context.deckVersion, session);
      requireCondition(root && deck && deck.version <= root.latestVersion, "INSTRUCTIONAL_IMAGE_FORBIDDEN");
      assertDeckVersionAccess(actor, root, deck);
      requireCondition(deck.content.cards.some(card => card.cardTemplateId === context.cardTemplateId), "INSTRUCTIONAL_IMAGE_FORBIDDEN");
    }
    const destination = context.stepId === "intro" ? version.content.intro : version.content.steps.find(step => step.stepId === context.stepId);
    const attachment = destination && stepMediaItems(destination).find(item => item.id === context.attachmentId);
    requireCondition(attachment?.kind === "image", "INSTRUCTIONAL_IMAGE_FORBIDDEN");
    const path = decodeURIComponent(new URL(attachment.media.src).pathname);
    const key = "assetId" in attachment.media ? attachment.media.assetId : path;
    // Main Card references are not proof of another learner's private file
    // ownership. These namespaces belong exclusively to personal CardData.
    requireCondition(!/(?:^|\/)(?:user-cards|user-decks)(?:\/|$)/i.test(path)
      && !/(?:^|\/)(?:user-cards|user-decks)(?:\/|$)/i.test(key), "INSTRUCTIONAL_IMAGE_FORBIDDEN");
    await assertNotInfoMedia(repo.db, "r2", attachment.media.src, session);
    return attachment.media;
  });
}
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie", "X-Content-Type-Options": "nosniff" };
const budget = createVisualRequestBudget();
type Dependencies = {
  enabled: boolean; currentUser: () => Promise<{ id: string } | null>;
  resolve: (actor: string, context: InstructionalImageContext) => Promise<ImageMediaItem>;
  read: (item: ImageMediaItem, signal: AbortSignal) => Promise<Response>;
  consumeBudget: (actor: string) => boolean;
};
const defaults: Dependencies = {
  // Ordinary canonical saves currently validate shape, not upload provenance.
  // This gate must remain off until the canonical provider/provenance review;
  // setting it is not itself a substitute for that review or ownership proof.
  enabled: process.env.SWITCHPLAY_PLUGGED_IN_VISUALS === "1" && process.env.INSTRUCTIONAL_IMAGES_PRIVATE_MEDIA_VERIFIED === "1",
  currentUser: async () => (await import("./auth")).getCurrentUser(),
  resolve: async (actor, context) => resolveInstructionalImage(await CardRepository.application(), actor, context),
  read: instructionalImageBytes, consumeBudget: budget,
};
/** Bounded buffering gives truthful failure status before returning private bytes.
 * Four active reads/responses bound aggregate buffering; runtime copies add overhead.
 * These process-local guards do not replace deployment-wide media abuse limits. */
export function createInstructionalImageHandler(deps: Dependencies = defaults) {
  let active = 0;
  const failure = (code: string, status: number, retry = false) => Response.json({ code }, { status,
    headers: { ...headers, ...(retry ? { "Retry-After": "1" } : {}) } });
  return async function GET(request: Request) {
    if (!deps.enabled) return failure("INSTRUCTIONAL_IMAGES_DISABLED", 404);
    let release = () => {}, responseOwnsSlot = false;
    try {
      const actor = await deps.currentUser(); if (!actor) return failure("UNAUTHENTICATED", 401);
      const context = readInstructionalImageContext(new URL(request.url).searchParams);
      if (!context) return failure("INVALID_INSTRUCTIONAL_IMAGE_CONTEXT", 400);
      if (context.viewerUserId !== actor.id) return failure("INSTRUCTIONAL_IMAGE_FORBIDDEN", 403);
      if (!deps.consumeBudget(actor.id) || active >= 4) return failure("INSTRUCTIONAL_IMAGE_RATE_LIMIT", 429, true);
      active++; let released = false;
      release = () => { if (!released) { released = true; active--; } };
      const signal = AbortSignal.any([request.signal, AbortSignal.timeout(15000)]);
      const item = await deps.resolve(actor.id, context), upstream = await deps.read(item, signal);
      if (!upstream.ok || !upstream.body) { await upstream.body?.cancel(); return failure("INSTRUCTIONAL_IMAGE_UNAVAILABLE", upstream.status === 404 ? 404 : 502); }
      const contentType = upstream.headers.get("Content-Type")?.split(";")[0];
      if (!contentType || !/^image\/(avif|gif|jpeg|png|webp)$/.test(contentType)) { await upstream.body.cancel(); return failure("INSTRUCTIONAL_IMAGE_UNAVAILABLE", 502); }
      const reader = upstream.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
      const cancel = () => { void reader.cancel().catch(() => {}); }; signal.addEventListener("abort", cancel, { once: true });
      try {
        while (true) {
          signal.throwIfAborted(); const part = await reader.read(); if (part.done) break;
          size += part.value.byteLength;
          if (size > MAX_INSTRUCTIONAL_IMAGE_BYTES) { await reader.cancel(); return failure("INSTRUCTIONAL_IMAGE_TOO_LARGE", 413); }
          chunks.push(part.value);
        }
        signal.throwIfAborted();
      } finally { signal.removeEventListener("abort", cancel); reader.releaseLock(); }
      if (!size) return failure("INSTRUCTIONAL_IMAGE_UNAVAILABLE", 502);
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      offset = 0;
      let bodyController: ReadableStreamDefaultController<Uint8Array>;
      const finish = () => { request.signal.removeEventListener("abort", aborted); release(); };
      const aborted = () => { finish(); bodyController.error(request.signal.reason); };
      const response = new Response(new ReadableStream<Uint8Array>({
        start(controller) { bodyController = controller; request.signal.addEventListener("abort", aborted, { once: true }); },
        pull(controller) {
          if (request.signal.aborted) { aborted(); return; }
          if (offset >= size) { controller.close(); finish(); return; }
          const end = Math.min(size, offset + 64 * 1024); controller.enqueue(bytes.subarray(offset, end)); offset = end;
        },
        cancel: finish,
      }), { headers: { ...headers, "Content-Type": contentType, "Content-Length": String(size), "Content-Disposition": "inline" } });
      responseOwnsSlot = true; return response;
    } catch (error) {
      if (error instanceof CardArchitectureError && ["INVALID_R2_REFERENCE", "INVALID_IMAGE_RESPONSE", "UNSUPPORTED_LEGACY_IMAGE_ORIGIN"].includes(error.code)) return failure("INSTRUCTIONAL_IMAGE_UNAVAILABLE", 502);
      if (error instanceof CardArchitectureError && error.code.endsWith("CONFIGURATION_REQUIRED")) return failure("INSTRUCTIONAL_IMAGE_UNAVAILABLE", 503);
      if (error instanceof CardArchitectureError) return failure(error.code, error.code.includes("CONFLICT") ? 409 : error.code.includes("INVALID") ? 400 : 403);
      return failure("INSTRUCTIONAL_IMAGE_UNAVAILABLE", 503);
    } finally { if (!responseOwnsSlot) release(); }
  };
}
