import { createHmac } from "node:crypto";
import { sameContent } from "./publicationRules";
import { SignJWT, jwtVerify } from "jose";
import type { CardRepository } from "./repository";
import type { CardForkSource, DeckForkSource, ForkContext, CardContent, DeckContent } from "./model";
import { assertCardVersionAccess, assertDeckVersionAccess } from "./versionAccess";
import { assertAdoption, isRecord, nonblank, requireCondition } from "./domain";
import { assertForkContext } from "./forks";
import type { MediaItem } from "../media";

export type ProspectiveUpload = { kind: "card"; source: CardForkSource; targetId: string; slot: "intro" | string; context: ForkContext }
  | { kind: "deck"; source: DeckForkSource; targetId: string; slot: "image" | "video"; context: ForkContext };
function secret() { requireCondition(nonblank(process.env.SESSION_SECRET), "UPLOAD_SIGNING_UNAVAILABLE"); return createHmac("sha256", process.env.SESSION_SECRET!).update("switchplay:creator-first-attachment:v1").digest(); }
export async function authorizeProspectiveUpload(repo: CardRepository, actor: string, input: unknown): Promise<ProspectiveUpload> {
  requireCondition(isRecord(input) && ["card", "deck"].includes(String(input.kind)) && nonblank(input.targetId) && nonblank(input.slot) && isRecord(input.source), "INVALID_PROSPECTIVE_UPLOAD");
  requireCondition(Object.keys(input).every((key) => ["kind", "source", "targetId", "slot", "context"].includes(key)), "INVALID_PROSPECTIVE_UPLOAD");
  assertForkContext(input.context); assertAdoption(input.source.version);
  requireCondition(Object.keys(input.source).length === 2 && nonblank(input.kind === "card" ? input.source.cardTemplateId : input.source.deckTemplateId), "INVALID_PROSPECTIVE_UPLOAD");
  const value = input as ProspectiveUpload;
  if (value.kind === "card") {
    const root = await repo.cards().findOne({ cardTemplateId: value.source.cardTemplateId });
    const version = await repo.getCardVersion(value.source.cardTemplateId, value.source.version);
    requireCondition(root && version, "MISSING_CARD_VERSION"); assertCardVersionAccess(actor, root, version);
    requireCondition(root.ownerUserId !== actor && (value.slot === "intro" || version.content.steps.some((step) => step.stepId === value.slot)), "INVALID_UPLOAD_SLOT");
    const target = await repo.cards().findOne({ cardTemplateId: value.targetId }); requireCondition(!target, "PROSPECTIVE_TARGET_CONFLICT");
  } else {
    const root = await repo.decks().findOne({ deckTemplateId: value.source.deckTemplateId });
    const version = await repo.getDeckVersion(value.source.deckTemplateId, value.source.version);
    requireCondition(root && version, "MISSING_DECK_VERSION"); assertDeckVersionAccess(actor, root, version);
    requireCondition(root.ownerUserId !== actor && ["image", "video"].includes(value.slot), "INVALID_UPLOAD_SLOT");
    const target = await repo.decks().findOne({ deckTemplateId: value.targetId }); requireCondition(!target, "PROSPECTIVE_TARGET_CONFLICT");
  }
  return value;
}
export async function signProspectiveAttachment(actor: string, prospective: ProspectiveUpload, assetId: string, provider: string, src?: string) {
  return new SignJWT({ purpose: "creator-first-attachment", actor, prospective, assetId, provider, src: src ?? `https://iframe.videodelivery.net/${encodeURIComponent(assetId)}` }).setProtectedHeader({ alg: "HS256" })
    .setIssuedAt().setExpirationTime("30m").sign(secret());
}
export async function assertProspectiveAttachment(actor: string, prospective: ProspectiveUpload, item: MediaItem, proofs: string[] = []) {
  requireCondition("assetId" in item && Array.isArray(proofs) && proofs.length <= 8 && proofs.every((proof) => nonblank(proof) && proof.length <= 4096), "INVALID_UPLOAD_ATTACHMENT");
  for (const proof of proofs) {
    let payload;
    try { payload = (await jwtVerify(proof, secret(), { algorithms: ["HS256"] })).payload; } catch { continue; }
    if (payload.purpose === "creator-first-attachment" && payload.actor === actor && payload.assetId === item.assetId && payload.src === item.src
      && payload.provider === ("provider" in item ? item.provider : undefined) && sameContent(payload.prospective, prospective)) return;
  }
  requireCondition(false, "INVALID_UPLOAD_ATTACHMENT");
}
function sameAsset(a: MediaItem | null | undefined, b: MediaItem | null | undefined) {
  if (a === b) return true;
  if (!a || !b || a.mediaType !== b.mediaType || a.src !== b.src) return false;
  return "assetId" in a && "assetId" in b ? a.assetId === b.assetId && a.provider === b.provider
    : !("assetId" in a) && !("assetId" in b) && a.id === b.id;
}
export async function validateForkAttachments(actor: string, prospective: Omit<ProspectiveUpload, "slot">,
  before: CardContent | DeckContent, after: CardContent | DeckContent, proofs?: string[]) {
  // Existing integrations may reuse canonical media freely. Only new provider assets need a prospective proof.
  if ("steps" in before && "steps" in after) {
    const originals = [before.intro.mediaItem, before.mediaItem, ...before.steps.map((step) => step.mediaItem)];
    for (const entry of [{ slot: "intro", item: after.intro.mediaItem }, { slot: "media", item: after.mediaItem }, ...after.steps.map((step) => ({ slot: step.forkedFrom?.stepId ?? step.stepId, item: step.mediaItem }))]) {
      if (!entry.item || originals.some((item) => sameAsset(item, entry.item))) continue;
      await assertProspectiveAttachment(actor, { ...prospective, slot: entry.slot } as ProspectiveUpload, entry.item, proofs);
    }
  } else if ("cards" in before && "cards" in after) {
    for (const slot of ["image", "video"] as const) {
      const item = after.introduction?.[slot];
      if (item && !sameAsset(before.introduction?.[slot], item)) await assertProspectiveAttachment(actor, { ...prospective, slot } as ProspectiveUpload, item, proofs);
    }
  }
}
