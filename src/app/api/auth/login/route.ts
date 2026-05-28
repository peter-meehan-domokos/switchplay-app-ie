import { authenticateUser, setSession } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return Response.json(
        { error: "Email and password are required." },
        { status: 400 },
      );
    }

    const user = await authenticateUser(email, password);

    if (!user) {
      return Response.json(
        { error: "Invalid email or password." },
        { status: 401 },
      );
    }

    await setSession(user);

    return Response.json({ user });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Invalid request body." }, { status: 400 });
    }

    console.error("Login failed", error);
    return Response.json({ error: "Unable to sign in." }, { status: 500 });
  }
}