import type { UserSafeguarding } from "./userSafeguarding";
import type { UserPermissions } from "./userPermissions";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { ObjectId, type ClientSession, type Db, type WithId } from "mongodb";
import type { CardData } from "./cards/model";
import { newAccountPermissions } from "./userPermissions";
import { validateCoreCredentials, validateNewPassword } from "./accountCredentials";
import type { UserDeckData } from "@/components/decks/types";
import { assertApplicationDatabase } from "@/lib/applicationDatabase";
import { getCollection } from "@/lib/mongodb";

const USERS_COLLECTION = "users";
const SESSION_COOKIE_NAME = "switchplay_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30;

type SessionUser = {
	userId: string;
	email: string;
	username: string;
	sessionVersion: number;
};

export type UserDocument = {
	safeguarding?: UserSafeguarding;
	permissions?: UserPermissions;
	emailVerifiedAt?: Date;
	sessionVersion?: number;
	passwordChangedAt?: Date;
	publicPublishingRevision?: number;
	email: string;
	username: string;
	passwordHash: string;
	cardsData?: CardData[];
	decksData: UserDeckData[];
	sharedDeckData?: SharedDeckDataReference[];
	isAdmin?: boolean;
	createdAt: Date;
	updatedAt: Date;
};

export type SharedDeckDataReference = {
	deckTemplateId: string;
	deckUserId: string; // user whose DeckData/progress this is, not template creator
};

export type LegacyAuthUser = {
	id: string;
	email: string;
	username: string;
	decksData: UserDeckData[];
	sharedDeckData: SharedDeckDataReference[];
	isAdmin: boolean;
	createdAt: string;
	updatedAt: string;
};

export type AuthUser = Omit<LegacyAuthUser, "decksData" | "sharedDeckData">;

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
		isAdmin: user.isAdmin === true,
		createdAt: toIsoString(user.createdAt),
		updatedAt: toIsoString(user.updatedAt),
	};
}

async function getUsersCollection() {
	assertApplicationDatabase();
	return getCollection<UserDocument>(USERS_COLLECTION);
}

export async function prepareSession(user: AuthUser, sessionVersion = 0) {
	return new SignJWT({
		email: user.email,
		username: user.username,
		sessionVersion,
	})
		.setProtectedHeader({ alg: "HS256" })
		.setSubject(user.id)
		.setIssuedAt()
		.setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
		.sign(getSessionSecret());
}

export async function readSessionToken(token: string): Promise<SessionUser | null> {
	try {
		const { payload } = await jwtVerify(token, getSessionSecret(), {
			algorithms: ["HS256"],
		});

		if (
			typeof payload.sub !== "string" ||
			typeof payload.email !== "string" ||
			typeof payload.username !== "string" ||
			!Number.isSafeInteger(payload.sessionVersion ?? 0) || Number(payload.sessionVersion ?? 0) < 0
		) {
			return null;
		}

		return {
			userId: payload.sub,
			email: payload.email,
			username: payload.username,
			sessionVersion: Number(payload.sessionVersion ?? 0),
		};
	} catch {
		return null;
	}
}

const AUTH_PROJECTION = { _id: 1, email: 1, username: 1, isAdmin: 1, createdAt: 1, updatedAt: 1, sessionVersion: 1 };

async function checkedCredentials(identifier: string, password: string) {
	const users = await getUsersCollection();
	const normalizedIdentifier = identifier.trim();
	const isEmailLogin = normalizedIdentifier.includes("@");
	const user = await users.findOne(
		isEmailLogin
			? { email: normalizedIdentifier.toLowerCase() }
			: { username: normalizedIdentifier },
		{ projection: { ...AUTH_PROJECTION, passwordHash: 1 } },
	);

	if (!user) {
		return null;
	}

	const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

	if (!isPasswordValid) {
		return null;
	}

	return { user: toAuthUser(user), version: user.sessionVersion ?? 0 };
}

export async function authenticateUser(identifier: string, password: string): Promise<AuthUser | null> {
	return (await checkedCredentials(identifier, password))?.user ?? null;
}

export async function preparePasswordSession(identifier: string, password: string) {
	const checked = await checkedCredentials(identifier, password);
	if (!checked) return null;
	// Never reload a newer version after checking an older password snapshot.
	return { user: checked.user, sessionToken: await prepareSession(checked.user, checked.version) };
}

export async function signInWithPassword(identifier: string, password: string): Promise<AuthUser | null> {
	const prepared = await preparePasswordSession(identifier, password);
	if (!prepared) return null;
	await writePreparedSessionCookie(prepared.sessionToken);
	return prepared.user;
}

// Compatibility helper. Version zero is safe for legacy callers; credential login
// must use signInWithPassword rather than stamping a fresh database version here.
export async function setSession(user: AuthUser) {
	await writePreparedSessionCookie(await prepareSession(user));
}

export async function writePreparedSessionCookie(sessionToken: string) {
	const cookieStore = await cookies();

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
	return getUserForSessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}

/** Same checks as getCurrentUser for a token read from a Cookie header (no next/headers request scope needed). */
export function sessionTokenFromCookieHeader(header: string | null): string | undefined {
	return header?.split(";").map(part => part.trim()).find(part => part.startsWith(`${SESSION_COOKIE_NAME}=`))?.slice(SESSION_COOKIE_NAME.length + 1);
}

export async function getUserForSessionToken(sessionToken: string | undefined): Promise<AuthUser | null> {
	if (!sessionToken) {
		return null;
	}

	const session = await readSessionToken(sessionToken);

	if (!session || !ObjectId.isValid(session.userId)) {
		return null;
	}

	const users = await getUsersCollection();
	const user = await users.findOne({ _id: new ObjectId(session.userId) }, { projection: AUTH_PROJECTION });

	return user && (user.sessionVersion ?? 0) === session.sessionVersion ? toAuthUser(user) : null;
}

/** Prepare outside any retried transaction; no account is persisted here. */
export async function prepareAccountCredentials(input: { username: unknown; email: unknown; password: unknown }, now = new Date()) {
 const credentials = validateCoreCredentials(input);
 const document: WithId<UserDocument> = {
  _id: new ObjectId(), username: credentials.username, email: credentials.email,
  passwordHash: await hashNewPassword(credentials.password), cardsData: [], decksData: [], sharedDeckData: [],
  isAdmin: false, permissions: newAccountPermissions(), sessionVersion: 0, createdAt: now, updatedAt: now,
 };
 const user = toAuthUser(document);
 const sessionToken = await prepareSession(user, 0);
 return { document, user, sessionToken };
}
export async function hashNewPassword(password: unknown) {
 return bcrypt.hash(validateNewPassword(password), 12);
}
/** Caller consumes matching email proof and inserts its profile in this same transaction. */
export async function insertAccount(db: Db, session: ClientSession, prepared: Awaited<ReturnType<typeof prepareAccountCredentials>>, emailVerifiedAt: Date) {
 if (!session.inTransaction()) throw new Error("ACCOUNT_TRANSACTION_REQUIRED");
 await db.collection<UserDocument>(USERS_COLLECTION).insertOne({ ...prepared.document, emailVerifiedAt }, { session });
 return prepared.user;
}
/** Let Mongo roll the transaction back; never turn a collision into an existing-account login. */
export function accountConflict(error: unknown): "username" | "email" | null {
 if (!error || typeof error !== "object" || !("code" in error) || error.code !== 11000) return null;
 const key = "keyPattern" in error ? error.keyPattern as Record<string, unknown> : {};
 return key.username ? "username" : key.email ? "email" : null;
}
