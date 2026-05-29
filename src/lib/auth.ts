import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { ObjectId, type WithId } from "mongodb";
import type { Deck } from "@/components/decks/types";
import { getCollection } from "@/lib/mongodb";

const USERS_COLLECTION = "users";
const SESSION_COOKIE_NAME = "switchplay_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30;

type SessionUser = {
	userId: string;
	email: string;
	username: string;
};

export type UserDocument = {
	email: string;
	username: string;
	passwordHash: string;
	decksData: Deck[];
	createdAt: Date;
	updatedAt: Date;
};

export type AuthUser = {
	id: string;
	email: string;
	username: string;
	decksData: Deck[];
	createdAt: string;
	updatedAt: string;
};

function normalizeEmail(email: string) {
	return email.trim().toLowerCase();
}

function getSessionSecret() {
	const secret = process.env.SESSION_SECRET;

	if (!secret) {
		throw new Error("SESSION_SECRET is not set.");
	}

	return new TextEncoder().encode(secret);
}

function toIsoString(value: Date | string) {
	return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toAuthUser(user: WithId<UserDocument>): AuthUser {
	return {
		id: user._id.toHexString(),
		email: user.email,
		username: user.username,
		decksData: user.decksData,
		createdAt: toIsoString(user.createdAt),
		updatedAt: toIsoString(user.updatedAt),
	};
}

async function getUsersCollection() {
	return getCollection<UserDocument>(USERS_COLLECTION);
}

async function createSessionToken(user: AuthUser) {
	return new SignJWT({
		email: user.email,
		username: user.username,
	})
		.setProtectedHeader({ alg: "HS256" })
		.setSubject(user.id)
		.setIssuedAt()
		.setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
		.sign(getSessionSecret());
}

async function readSessionToken(token: string): Promise<SessionUser | null> {
	try {
		const { payload } = await jwtVerify(token, getSessionSecret(), {
			algorithms: ["HS256"],
		});

		if (
			typeof payload.sub !== "string" ||
			typeof payload.email !== "string" ||
			typeof payload.username !== "string"
		) {
			return null;
		}

		return {
			userId: payload.sub,
			email: payload.email,
			username: payload.username,
		};
	} catch {
		return null;
	}
}

export async function authenticateUser(identifier: string, password: string): Promise<AuthUser | null> {
	const users = await getUsersCollection();
	const normalizedIdentifier = identifier.trim();
	const isEmailLogin = normalizedIdentifier.includes("@");
	const user = await users.findOne(
		isEmailLogin
			? { email: normalizedIdentifier.toLowerCase() }
			: { username: normalizedIdentifier },
	);

	if (!user) {
		return null;
	}

	const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

	if (!isPasswordValid) {
		return null;
	}

	return toAuthUser(user);
}

export async function setSession(user: AuthUser) {
	const cookieStore = await cookies();
	const sessionToken = await createSessionToken(user);

	cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
		httpOnly: true,
		maxAge: SESSION_DURATION_SECONDS,
		path: "/",
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
	});
}

export async function clearSession() {
	const cookieStore = await cookies();

	cookieStore.set(SESSION_COOKIE_NAME, "", {
		httpOnly: true,
		maxAge: 0,
		path: "/",
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
	});
}

export async function getCurrentUser(): Promise<AuthUser | null> {
	const cookieStore = await cookies();
	const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

	if (!sessionToken) {
		return null;
	}

	const session = await readSessionToken(sessionToken);

	if (!session || !ObjectId.isValid(session.userId)) {
		return null;
	}

	const users = await getUsersCollection();
	const user = await users.findOne({ _id: new ObjectId(session.userId) });

	return user ? toAuthUser(user) : null;
}
