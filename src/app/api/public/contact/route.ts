import { getCollection } from "@/lib/mongodb";
import {
  type ContactSupportErrorResponse,
  type ContactSupportRequestData,
  type ContactSupportSuccessResponse,
  type ContactSupportPurpose,
  validateContactSupportInput,
} from "@/lib/publicContactSupport";

const CONTACT_SUPPORT_COLLECTION = "contactSupportSubmissions";

type ContactSupportSubmissionDocument = {
  name: string;
  email: string | null;
  phone: string | null;
  purpose: ContactSupportPurpose;
  message: string;
  source: "contact-page";
  timestamp: Date;
};

function jsonResponse<TBody>(body: TBody, status: number) {
  return Response.json(body, { status });
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("application/json")) {
    return jsonResponse<ContactSupportErrorResponse>(
      { ok: false, error: "Please send this request as JSON." },
      415,
    );
  }

  let body: ContactSupportRequestData;

  try {
    body = await request.json();
  } catch {
    return jsonResponse<ContactSupportErrorResponse>(
      { ok: false, error: "Invalid request body." },
      400,
    );
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonResponse<ContactSupportErrorResponse>(
      { ok: false, error: "Invalid request body." },
      400,
    );
  }

  if (typeof body.companyWebsite === "string" && body.companyWebsite.trim().length > 0) {
    return jsonResponse<ContactSupportSuccessResponse>({ ok: true }, 201);
  }

  const validation = validateContactSupportInput(body);

  if (!validation.ok) {
    return jsonResponse<ContactSupportErrorResponse>(
      {
        ok: false,
        error: "Please check the highlighted fields.",
        fieldErrors: validation.fieldErrors,
      },
      400,
    );
  }

  try {
    const collection = await getCollection<ContactSupportSubmissionDocument>(CONTACT_SUPPORT_COLLECTION);

    await collection.insertOne({
      ...validation.data,
      source: "contact-page",
      timestamp: new Date(),
    });

    return jsonResponse<ContactSupportSuccessResponse>({ ok: true }, 201);
  } catch (error) {
    console.error("Unable to store contact support submission", error);

    return jsonResponse<ContactSupportErrorResponse>(
      { ok: false, error: "Something went wrong." },
      500,
    );
  }
}
