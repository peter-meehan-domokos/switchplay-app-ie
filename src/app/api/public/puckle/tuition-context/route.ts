import { tuitionContextResponse } from "@/lib/puckleEnquiries";

export async function GET() {
  return tuitionContextResponse();
}
