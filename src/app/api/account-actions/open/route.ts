import { emailActionDocument } from "@/lib/emailActionDocument";
export const dynamic = "force-dynamic";
export function GET() { return emailActionDocument(); }
