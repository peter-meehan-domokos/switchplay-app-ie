import { getCollection } from "@/lib/mongodb";
import {
  ENQUIRY_SUCCESS_MESSAGE,
  type EnquiryErrorResponse,
  type EnquiryRequestData,
  type EnquirySuccessResponse,
  type ValidatedEnquiryData,
  validateTuitionEnquiry,
} from "@/app/sites/puckle/lib/publicTuitionEnquiry";

// The URL keeps its original name. Enquiries are stored in their own collection, so historical early-access
// signups (and the unique email/phone indexes on that collection) are left untouched.
const TUITION_ENQUIRY_COLLECTION = "puckleTuitionEnquiries";

type TuitionEnquiryDocument = ValidatedEnquiryData & {
  source: "public-homepage";
  createdAt: Date;
};

function jsonResponse<TBody>(body: TBody, status: number) {
  return Response.json(body, { status });
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("application/json")) {
    return jsonResponse<EnquiryErrorResponse>({ ok: false, error: "Please send this request as JSON." }, 415);
  }

  let body: EnquiryRequestData;

  try {
    body = await request.json();
  } catch {
    return jsonResponse<EnquiryErrorResponse>({ ok: false, error: "Invalid request body." }, 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonResponse<EnquiryErrorResponse>({ ok: false, error: "Invalid request body." }, 400);
  }

  if (typeof body.companyWebsite === "string" && body.companyWebsite.trim().length > 0) {
    // Honeypot: pretend success without storing anything.
    return jsonResponse<EnquirySuccessResponse>({ ok: true, message: ENQUIRY_SUCCESS_MESSAGE }, 201);
  }

  const validation = validateTuitionEnquiry(body);

  if (!validation.ok) {
    return jsonResponse<EnquiryErrorResponse>(
      { ok: false, error: "Please check the highlighted fields.", fieldErrors: validation.fieldErrors },
      400,
    );
  }

  try {
    const collection = await getCollection<TuitionEnquiryDocument>(TUITION_ENQUIRY_COLLECTION);
    await collection.insertOne({ ...validation.data, source: "public-homepage", createdAt: new Date() });

    return jsonResponse<EnquirySuccessResponse>({ ok: true, message: ENQUIRY_SUCCESS_MESSAGE }, 201);
  } catch (error) {
    console.error("Unable to store tuition enquiry", error);

    return jsonResponse<EnquiryErrorResponse>(
      { ok: false, error: "Something went wrong and your response was not sent. Please try again." },
      500,
    );
  }
}
