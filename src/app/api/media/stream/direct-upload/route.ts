import { ObjectId } from "mongodb";
import { getCurrentUser } from "@/lib/auth";
import {
  CloudflareStreamApiError,
  CloudflareStreamConfigError,
  createCloudflareStreamDirectUpload,
} from "@/lib/cloudflareStream";

type DirectUploadRequestBody = {
  name?: string;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateDirectUploadRequestBody(body: unknown): { ok: true; body: DirectUploadRequestBody } | { ok: false; error: string } {
  if (!isPlainObject(body)) {
    return { ok: false, error: "Request body must be an object." };
  }

  const allowedFields = new Set(["name"]);
  const unsupportedField = Object.keys(body).find((fieldName) => !allowedFields.has(fieldName));

  if (unsupportedField) {
    return { ok: false, error: `${unsupportedField} is not supported.` };
  }

  if (body.name === undefined) {
    return { ok: true, body: {} };
  }

  if (typeof body.name !== "string") {
    return { ok: false, error: "name must be a string when provided." };
  }

  const name = body.name.trim();

  if (name.length === 0) {
    return { ok: true, body: {} };
  }

  if (name.length > 120) {
    return { ok: false, error: "name must be 120 characters or fewer." };
  }

  return { ok: true, body: { name } };
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
