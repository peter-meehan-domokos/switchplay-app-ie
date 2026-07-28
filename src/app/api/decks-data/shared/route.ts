import { ObjectId } from "mongodb";
import { getCurrentUser } from "@/lib/auth";
import { getSharedDecksForUser } from "@/lib/sharedDecks";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return Response.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (!ObjectId.isValid(user.id)) {
      return Response.json({ error: "Invalid authenticated user." }, { status: 401 });
    }

    const decks = await getSharedDecksForUser(user);

    return Response.json({ decks });
  } catch (error) {
    console.error("Unable to load shared decks", error);
    return Response.json({ error: "Unable to load shared decks." }, { status: 500 });
  }
}