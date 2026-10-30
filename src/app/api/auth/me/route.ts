import { getCurrentUser } from "@/lib/auth";
import { visualGuestLoginContext } from "@/lib/visualLearningRecords/guestServer";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ user: null }, { status: 401 });
  }

  const visualGuest = await visualGuestLoginContext(user.id);
  return Response.json({ user, ...(visualGuest ? { visualGuest } : {}) }, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
}
