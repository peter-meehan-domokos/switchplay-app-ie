import { getCollection } from "@/lib/mongodb";
import {
  type CreatorInterestErrorResponse,
  type CreatorInterestRequestData,
  type CreatorInterestSuccessResponse,
  validateCreatorInterestInput,
} from "@/lib/publicCreatorInterest";

const CREATOR_INTEREST_COLLECTION = "creatorInterestSubmissions";

type CreatorInterestSubmissionDocument = {
  name: string;
  email: string | null;
  phone: string | null;
  age: number;
  location: string;
  creatorIdea: string;
  additionalInformation: string;
  source: "public-homepage";
  status: "new";
  createdAt: Date;
};

function jsonResponse<TBody>(body: TBody, status: number) {
  return Response.json(body, { status });
}

function isDuplicateKeyError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("application/json")) {
    return jsonResponse<CreatorInterestErrorResponse>(
      { ok: false, error: "Please send this request as JSON." },
      415,
    );
  }

  let body: CreatorInterestRequestData;

  try {
    body = await request.json();
  } catch {
    return jsonResponse<CreatorInterestErrorResponse>(
      { ok: false, error: "Invalid request body." },
      400,
    );
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonResponse<CreatorInterestErrorResponse>(
      { ok: false, error: "Invalid request body." },
      400,
    );
  }

  if (typeof body.companyWebsite === "string" && body.companyWebsite.trim().length > 0) {
    return jsonResponse<CreatorInterestSuccessResponse>({ ok: true }, 201);
  }

  const validation = validateCreatorInterestInput(body);

  if (!validation.ok) {
    return jsonResponse<CreatorInterestErrorResponse>(
      {
        ok: false,
        error: "Please check the highlighted fields.",
        fieldErrors: validation.fieldErrors,
      },
      400,
    );
  }

  try {
    const collection = await getCollection<CreatorInterestSubmissionDocument>(CREATOR_INTEREST_COLLECTION);
    const duplicateConditions = [
      validation.data.email ? { email: validation.data.email } : null,
      validation.data.phone ? { phone: validation.data.phone } : null,
    ].filter((condition): condition is { email: string } | { phone: string } => Boolean(condition));

    const existingSubmission =
      duplicateConditions.length > 0 ? await collection.findOne({ $or: duplicateConditions }) : null;

    if (existingSubmission) {
      return jsonResponse<CreatorInterestSuccessResponse>({ ok: true }, 200);
    }

    await collection.insertOne({
      ...validation.data,
      source: "public-homepage",
      status: "new",
      createdAt: new Date(),
    });

    return jsonResponse<CreatorInterestSuccessResponse>({ ok: true }, 201);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return jsonResponse<CreatorInterestSuccessResponse>({ ok: true }, 200);
    }

    console.error("Unable to store creator interest submission", error);

    return jsonResponse<CreatorInterestErrorResponse>(
      { ok: false, error: "Something went wrong and your response was not sent. Please try again." },
      500,
    );
  }
}
