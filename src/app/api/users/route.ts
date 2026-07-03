import { getCurrentUser, type UserDocument } from "@/lib/auth";
import { getCollection } from "@/lib/mongodb";

const USERS_COLLECTION = "users";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const usersCollection = await getCollection<UserDocument>(USERS_COLLECTION);
    const users = await usersCollection
      .find({}, { projection: { username: 1 } })
      .sort({ username: 1 })
      .toArray();

    return Response.json({
      users: users.map((entry) => ({
        id: entry._id.toHexString(),
        name: entry.username,
      })),
    });
  } catch (error) {
    console.error("Unable to load users", error);
    return Response.json({ error: "Unable to load users." }, { status: 500 });
  }
}