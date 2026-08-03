import { type Collection } from "mongodb";
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
  email: string | null;
  phone: string | null;
  goals: string;
  additionalInformation: string;
  source: "public-homepage";
  createdAt: Date;
};

function jsonResponse<TBody>(body: TBody, status: number) {
  return Response.json(body, { status });
}

function isDuplicateKeyError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

async function prepareEarlyAccessIndexes(collection: Collection<EarlyAccessSignupDocument>) {
  const indexes = await collection.listIndexes().toArray();
  const oldEmailIndex = indexes.find((index) => index.name === "email_1" && index.unique && !index.partialFilterExpression);

  if (oldEmailIndex) {
    await collection.dropIndex("email_1");
  }

  await collection.createIndex(
    { email: 1 },
    {
      name: "earlyAccessEmailUnique",
      unique: true,
      partialFilterExpression: { email: { $type: "string" } },
    },
  );
  await collection.createIndex(
    { phone: 1 },
    {
      name: "earlyAccessPhoneUnique",
      unique: true,
      partialFilterExpression: { phone: { $type: "string" } },
    },
  );
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
    await prepareEarlyAccessIndexes(collection);
    const duplicateConditions = [
      validation.data.email ? { email: validation.data.email } : null,
      validation.data.phone ? { phone: validation.data.phone } : null,
    ].filter((condition): condition is { email: string } | { phone: string } => Boolean(condition));

    const existingSignup =
      duplicateConditions.length > 0 ? await collection.findOne({ $or: duplicateConditions }) : null;

    if (existingSignup) {
      return jsonResponse<EarlyAccessSuccessResponse>(
        {
          ok: true,
          message: "You are already on the early access list.",
        },
        200,
      );
    }

    await collection.insertOne({
      ...validation.data,
      source: "public-homepage",
      createdAt: new Date(),
    });

    return jsonResponse<EarlyAccessSuccessResponse>(
      {
        ok: true,
        message: "Thanks, you are on the early access list.",
      },
      201,
    );
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return jsonResponse<EarlyAccessSuccessResponse>(
        {
          ok: true,
          message: "You are already on the early access list.",
        },
        200,
      );
    }

    console.error("Unable to store early access signup", error);

    return jsonResponse<EarlyAccessErrorResponse>(
      { ok: false, error: "Something went wrong and your response was not sent. Please try again." },
      500,
    );
  }
}
