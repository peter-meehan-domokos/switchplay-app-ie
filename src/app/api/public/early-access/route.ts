import { getCollection } from "@/lib/mongodb";
import {
  type EarlyAccessErrorResponse,
  type EarlyAccessRequestData,
  type EarlyAccessSuccessResponse,
  validateEarlyAccessInput,
} from "@/lib/publicEarlyAccess";

const EARLY_ACCESS_COLLECTION = "earlyAccessSignups";

type EarlyAccessSignupDocument = {
  name: string;
  email: string;
  goals: string;
  additionalInformation: string;
  source: "public-homepage";
  createdAt: Date;
};

function jsonResponse<TBody>(body: TBody, status: number) {
  return Response.json(body, { status });
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("application/json")) {
    return jsonResponse<EarlyAccessErrorResponse>(
      { ok: false, error: "Please send this request as JSON." },
      415,
    );
  }

  let body: EarlyAccessRequestData;

  try {
    body = await request.json();
  } catch {
    return jsonResponse<EarlyAccessErrorResponse>(
      { ok: false, error: "Invalid request body." },
      400,
    );
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonResponse<EarlyAccessErrorResponse>(
      { ok: false, error: "Invalid request body." },
      400,
    );
  }

  if (typeof body.companyWebsite === "string" && body.companyWebsite.trim().length > 0) {
    return jsonResponse<EarlyAccessSuccessResponse>(
      {
        ok: true,
        message: "Thanks, you are on the early access list.",
      },
      201,
    );
  }

  const validation = validateEarlyAccessInput(body);

  if (!validation.ok) {
    return jsonResponse<EarlyAccessErrorResponse>(
      {
        ok: false,
        error: "Please check the highlighted fields.",
        fieldErrors: validation.fieldErrors,
      },
      400,
    );
  }

  try {
    const collection = await getCollection<EarlyAccessSignupDocument>(EARLY_ACCESS_COLLECTION);

    await collection.createIndex({ email: 1 }, { unique: true });
    const result = await collection.updateOne(
      { email: validation.data.email },
      {
        $setOnInsert: {
          ...validation.data,
          source: "public-homepage",
          createdAt: new Date(),
        },
      },
      { upsert: true },
    );

    return jsonResponse<EarlyAccessSuccessResponse>(
      {
        ok: true,
        message:
          result.upsertedCount === 0
            ? "You are already on the early access list."
            : "Thanks, you are on the early access list.",
      },
      result.upsertedCount === 0 ? 200 : 201,
    );
  } catch (error) {
    console.error("Unable to store early access signup", error);

    return jsonResponse<EarlyAccessErrorResponse>(
      { ok: false, error: "Something went wrong and your response was not sent. Please try again." },
      500,
    );
  }
}
