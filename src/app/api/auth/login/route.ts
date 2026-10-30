import { authenticateUser, setSession } from "@/lib/auth";
import { visualGuestLoginContext } from "@/lib/visualLearningRecords/guestServer";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const identifier = typeof body.identifier === "string" ? body.identifier : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!identifier || !password) {
      return Response.json(
        { error: "Username/email and password are required." },
        { status: 400 },
      );
    }

    const user = await authenticateUser(identifier, password);

    if (!user) {
      return Response.json(
        { error: "Invalid login details." },
        { status: 401 },
      );
    }

    await setSession(user);

    const visualGuest = await visualGuestLoginContext(user.id);
    return Response.json({ user, ...(visualGuest ? { visualGuest } : {}) }, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Invalid request body." }, { status: 400 });
    }

    console.error("Login failed", error);
    return Response.json({ error: "Unable to sign in." }, { status: 500 });
  }
}
