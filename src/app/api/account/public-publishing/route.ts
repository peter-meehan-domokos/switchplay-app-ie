import { getCurrentUser } from "@/lib/auth";
import { getCollection } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export const runtime = "nodejs";

// Advisory read for the Creator UI only. It is never an authorisation decision: the publication
// transaction (requirePublicPublishing) remains authoritative. Own permission only, no caching.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const users = await getCollection<{ permissions?: unknown }>("users");
  const document = await users.findOne({ _id: new ObjectId(user.id) as never }, { projection: { permissions: 1 } });
  const permissions = document?.permissions;
  const allowed = typeof permissions === "object" && permissions !== null && !Array.isArray(permissions)
    && (permissions as { publicPublishing?: unknown }).publicPublishing === true;
  return Response.json({ allowed }, { headers: { "Cache-Control": "no-store" } });
}
