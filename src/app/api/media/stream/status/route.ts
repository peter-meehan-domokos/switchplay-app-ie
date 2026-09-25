import { ObjectId } from "mongodb";
import { getCurrentUser } from "@/lib/auth";
import {
  CloudflareStreamApiError,
  CloudflareStreamConfigError,
  getCloudflareStreamVideoStatus,
} from "@/lib/cloudflareStream";
import { getVisibleDeckTemplateDocumentByIdForUser } from "@/lib/deckTemplateQueries";
import { isCloudflareStreamVideoMediaItem } from "@/lib/media";
import { authorizeUserCardUpload } from "@/lib/userCardUploadAuthorization";

type StatusTarget =
  | {
      assetId: string;
      deckTemplateId: string;
      scope: "deck-introduction";
    }
  | {
      assetId: string;
      cardId: string;
      deckTemplateId: string;
      scope: "user-card";
    };

function readRequiredSearchParam(searchParams: URLSearchParams, name: string) {
  const value = searchParams.get(name)?.trim();

  return value || null;
}

function readStatusTarget(request: Request): { ok: true; target: StatusTarget } | { ok: false; error: string } {
  const searchParams = new URL(request.url).searchParams;
  const scope = searchParams.get("scope");
  const deckTemplateId = readRequiredSearchParam(searchParams, "deckTemplateId");
  const assetId = readRequiredSearchParam(searchParams, "assetId");

  if (!deckTemplateId) {
    return { ok: false, error: "deckTemplateId is required." };
  }

  if (!assetId) {
    return { ok: false, error: "assetId is required." };
  }

  if (scope === "deck-introduction") {
    return { ok: true, target: { assetId, deckTemplateId, scope } };
  }

  if (scope === "user-card") {
    const cardId = readRequiredSearchParam(searchParams, "cardId");

    if (!cardId) {
      return { ok: false, error: "cardId is required." };
    }

    return { ok: true, target: { assetId, cardId, deckTemplateId, scope } };
  }

  return { ok: false, error: "scope must be deck-introduction or user-card." };
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return Response.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (!ObjectId.isValid(user.id)) {
      return Response.json({ error: "Invalid authenticated user." }, { status: 401 });
    }

    const validation = readStatusTarget(request);

    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    const { target } = validation;

    if (target.scope === "user-card") {
      const authorization = await authorizeUserCardUpload(user, target.deckTemplateId, target.cardId);

      if (!authorization.ok) {
        return Response.json({ error: authorization.error }, { status: authorization.status });
      }

      const card = user.decksData
        .find((deckData) => deckData.deckTemplateId === target.deckTemplateId)
        ?.cards.find((candidate) => candidate.cardId === target.cardId);
      const hasVideo = card?.mediaItems.some(
        (mediaItem) => isCloudflareStreamVideoMediaItem(mediaItem) && mediaItem.assetId === target.assetId,
      );

      if (!hasVideo) {
        return Response.json({ error: "Video is not part of this card." }, { status: 404 });
      }
    } else {
      const templateDocument = await getVisibleDeckTemplateDocumentByIdForUser(user, target.deckTemplateId);

      if (!templateDocument) {
        return Response.json({ error: "You do not have access to this deck template." }, { status: 403 });
      }

      const editableTemplate = templateDocument.savedTemplate ?? templateDocument.template;
      const introductionVideo = editableTemplate.introduction?.video;

      if (!isCloudflareStreamVideoMediaItem(introductionVideo) || introductionVideo.assetId !== target.assetId) {
        return Response.json({ error: "Video is not part of this deck introduction." }, { status: 404 });
      }
    }

    const status = await getCloudflareStreamVideoStatus(target.assetId);

    return Response.json(status, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof CloudflareStreamConfigError) {
      console.error("Cloudflare Stream configuration error", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    if (error instanceof CloudflareStreamApiError) {
      console.error("Unable to retrieve Cloudflare Stream video status", error);

      if (error.status === 404) {
        return Response.json({ status: "failed" });
      }

      return Response.json(
        { error: "Unable to retrieve video processing status." },
        { status: error.status >= 400 && error.status < 500 ? 502 : error.status },
      );
    }

    console.error("Unable to retrieve Cloudflare Stream video status", error);
    return Response.json({ error: "Unable to retrieve video processing status." }, { status: 500 });
  }
}
