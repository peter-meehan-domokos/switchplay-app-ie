import { ObjectId } from "mongodb";
import { getCurrentUser } from "@/lib/auth";
import {
  CloudflareStreamApiError,
  CloudflareStreamConfigError,
  createCloudflareStreamDirectUpload,
} from "@/lib/cloudflareStream";
import { authorizeUserCardUpload } from "@/lib/userCardUploadAuthorization";

type TemplateVideoDirectUploadRequestBody = {
  name?: string;
};

type UserCardVideoDirectUploadRequestBody = {
  cardId?: string;
  deckTemplateId?: string;
  originalFilename?: string;
  scope?: string;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateDirectUploadRequestBody(
  body: unknown,
):
  | { ok: true; body: TemplateVideoDirectUploadRequestBody; scope: "template-video" }
  | { ok: true; body: Required<UserCardVideoDirectUploadRequestBody>; scope: "user-card" }
  | { ok: false; error: string } {
  if (!isPlainObject(body)) {
    return { ok: false, error: "Request body must be an object." };
  }

  const isUserCardScope = body.scope === "user-card";
  const allowedFields = isUserCardScope
    ? new Set(["scope", "deckTemplateId", "cardId", "originalFilename"])
    : new Set(["name"]);
  const unsupportedField = Object.keys(body).find((fieldName) => !allowedFields.has(fieldName));

  if (unsupportedField) {
    return { ok: false, error: `${unsupportedField} is not supported.` };
  }

  if (isUserCardScope) {
    if (!hasNonEmptyString(body.deckTemplateId)) {
      return { ok: false, error: "deckTemplateId is required." };
    }

    if (!hasNonEmptyString(body.cardId)) {
      return { ok: false, error: "cardId is required." };
    }

    if (!hasNonEmptyString(body.originalFilename)) {
      return { ok: false, error: "originalFilename is required." };
    }

    const originalFilename = body.originalFilename.trim();

    if (originalFilename.length > 120) {
      return { ok: false, error: "originalFilename must be 120 characters or fewer." };
    }

    return {
      ok: true,
      body: {
        scope: "user-card",
        deckTemplateId: body.deckTemplateId.trim(),
        cardId: body.cardId.trim(),
        originalFilename,
      },
      scope: "user-card",
    };
  }

  if (body.name === undefined) {
    return { ok: true, body: {}, scope: "template-video" };
  }

  if (typeof body.name !== "string") {
    return { ok: false, error: "name must be a string when provided." };
  }

  const name = body.name.trim();

  if (name.length === 0) {
    return { ok: true, body: {}, scope: "template-video" };
  }

  if (name.length > 120) {
    return { ok: false, error: "name must be 120 characters or fewer." };
  }

  return { ok: true, body: { name }, scope: "template-video" };
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

      const name = `user-card / ${user.id} / ${validation.body.deckTemplateId} / ${validation.body.cardId} / ${new Date().toISOString()} / ${validation.body.originalFilename}`;
      const directUpload = await createCloudflareStreamDirectUpload({
        creator: user.id,
        name,
      });

      return Response.json(directUpload, { status: 201 });
    }

    const directUpload = await createCloudflareStreamDirectUpload({
      creator: user.id,
      name: validation.body.name,
    });

    return Response.json(directUpload, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Invalid request body." }, { status: 400 });
    }

    if (error instanceof CloudflareStreamConfigError) {
      console.error("Cloudflare Stream configuration error", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    if (error instanceof CloudflareStreamApiError) {
      console.error("Unable to create Cloudflare Stream direct upload", error);
      return Response.json({ error: "Unable to create Stream direct upload." }, { status: error.status >= 400 && error.status < 500 ? 502 : error.status });
    }

    console.error("Unable to create Stream direct upload", error);
    return Response.json({ error: "Unable to create Stream direct upload." }, { status: 500 });
  }
}
