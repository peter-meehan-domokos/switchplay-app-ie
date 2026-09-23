import { ObjectId } from "mongodb";
import { getCurrentUser } from "@/lib/auth";
import {
  CloudflareR2ConfigError,
  CloudflareR2PresignError,
  CloudflareR2ValidationError,
  createCloudflareR2DirectUpload,
  createCloudflareR2UserCardImageDirectUpload,
} from "@/lib/cloudflareR2";
import { isSupportedImageUploadContentType } from "@/lib/imageUploadContentTypes";
import { authorizeUserCardUpload } from "@/lib/userCardUploadAuthorization";

type TemplateImageDirectUploadRequestBody = {
  contentType?: string;
  deckTemplateId?: string;
};

type UserCardImageDirectUploadRequestBody = {
  cardId?: string;
  contentType?: string;
  deckTemplateId?: string;
  scope?: string;
};

const DECK_TEMPLATE_ID_FOR_OBJECT_KEY_PATTERN = /^[a-zA-Z0-9-]+$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateDirectUploadRequestBody(
  body: unknown,
):
  | { ok: true; body: TemplateImageDirectUploadRequestBody; scope: "template-image" }
  | { ok: true; body: Required<UserCardImageDirectUploadRequestBody>; scope: "user-card" }
  | { ok: false; error: string } {
  if (!isPlainObject(body)) {
    return { ok: false, error: "Request body must be an object." };
  }

  const isUserCardScope = body.scope === "user-card";
  const allowedFields = isUserCardScope
    ? new Set(["scope", "contentType", "deckTemplateId", "cardId"])
    : new Set(["contentType", "deckTemplateId"]);
  const unsupportedField = Object.keys(body).find((fieldName) => !allowedFields.has(fieldName));

  if (unsupportedField) {
    return { ok: false, error: `${unsupportedField} is not supported.` };
  }

  if (typeof body.contentType !== "string") {
    return { ok: false, error: "contentType is required." };
  }

  const contentType = body.contentType.trim();

  if (!isSupportedImageUploadContentType(contentType)) {
    return { ok: false, error: "Unsupported image content type." };
  }

  if (typeof body.deckTemplateId !== "string") {
    return { ok: false, error: "deckTemplateId is required." };
  }

  const deckTemplateId = body.deckTemplateId.trim();

  if (!DECK_TEMPLATE_ID_FOR_OBJECT_KEY_PATTERN.test(deckTemplateId)) {
    return { ok: false, error: "deckTemplateId contains unsupported characters." };
  }

  if (!isUserCardScope) {
    return { ok: true, body: { contentType, deckTemplateId }, scope: "template-image" };
  }

  if (!hasNonEmptyString(body.cardId)) {
    return { ok: false, error: "cardId is required." };
  }

  return {
    ok: true,
    body: {
      scope: "user-card",
      contentType,
      deckTemplateId,
      cardId: body.cardId.trim(),
    },
    scope: "user-card",
  };
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return Response.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (!ObjectId.isValid(user.id)) {
      return Response.json({ error: "Invalid authenticated user." }, { status: 401 });
    }

    const body = await request.json();
    const validation = validateDirectUploadRequestBody(body);

    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    if (validation.scope === "user-card") {
      const authorization = await authorizeUserCardUpload(user, validation.body.deckTemplateId, validation.body.cardId);

      if (!authorization.ok) {
        return Response.json({ error: authorization.error }, { status: authorization.status });
      }

      const directUpload = await createCloudflareR2UserCardImageDirectUpload({
        creator: user.id,
        contentType: validation.body.contentType,
        deckTemplateId: validation.body.deckTemplateId,
        cardId: validation.body.cardId,
      });

      return Response.json(directUpload, { status: 201 });
    }

    const directUpload = await createCloudflareR2DirectUpload({
      creator: user.id,
      contentType: validation.body.contentType ?? "",
      deckTemplateId: validation.body.deckTemplateId ?? "",
    });

    return Response.json(directUpload, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Invalid request body." }, { status: 400 });
    }

    if (error instanceof CloudflareR2ValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof CloudflareR2ConfigError) {
      console.error("Cloudflare R2 configuration error", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    if (error instanceof CloudflareR2PresignError) {
      console.error("Unable to create Cloudflare R2 direct upload", error);
      return Response.json({ error: "Unable to create image direct upload." }, { status: 500 });
    }

    console.error("Unable to create image direct upload", error);
    return Response.json({ error: "Unable to create image direct upload." }, { status: 500 });
  }
}
