import { visitorCountryFromHeaders } from "@/lib/phoneCountries";

// Only chooses the initial country in phone inputs. Nothing is stored and no external service is called.
export async function GET(request: Request) {
  return Response.json({ country: visitorCountryFromHeaders(request.headers) }, { headers: { "Cache-Control": "private, no-store" } });
}
