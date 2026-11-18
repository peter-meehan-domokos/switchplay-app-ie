import { after } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { saveTuitionEnquiry, userFromRequest } from "@/lib/puckleEnquiries";
import {
  ENQUIRY_SUCCESS_MESSAGE,
  type EnquiryErrorResponse,
  type EnquiryRequestData,
  type EnquirySuccessResponse,
} from "@/app/sites/puckle/lib/publicTuitionEnquiry";

// The URL keeps its original name. Enquiries are stored in their own collection (puckleTuitionEnquiries),
// independent of accounts and memberships.
const TUITION_ENQUIRY_COLLECTION = "puckleTuitionEnquiries";

function jsonResponse<TBody>(body: TBody, status: number) {
  return Response.json(body, { status });
}

/** Founder alert after the response; outside a request scope (direct handler calls) it simply runs unawaited. */
function scheduleNotification(notify: () => Promise<void>) {
  try { after(notify); } catch { void notify(); }
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

  try {
    const db = await getDatabase();
    // A failed account lookup is an error, never a silent fall-back to the adult path.
    const result = await saveTuitionEnquiry(db, body, await userFromRequest(request), new Date(), TUITION_ENQUIRY_COLLECTION);

    if (!result.ok) {
      return jsonResponse<EnquiryErrorResponse>(
        { ok: false, error: "Please check the highlighted fields.", fieldErrors: result.fieldErrors },
        400,
      );
    }

    scheduleNotification(result.notify);
    return jsonResponse<EnquirySuccessResponse>({ ok: true, message: ENQUIRY_SUCCESS_MESSAGE }, 201);
  } catch (error) {
    console.error("Unable to store tuition enquiry", error);

    return jsonResponse<EnquiryErrorResponse>(
      { ok: false, error: "Something went wrong and your response was not sent. Please try again." },
      500,
    );
  }
}
