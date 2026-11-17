// Session token verification only: no database, cookies() or request scope, so the proxy can use it too.
import { jwtVerify } from "jose";

export const SESSION_COOKIE_NAME = "switchplay_session";

export type SessionUser = {
	userId: string;
	email: string;
	username: string;
	sessionVersion: number;
};

export function getSessionSecret() {
	const secret = process.env.SESSION_SECRET;

	if (!secret) {
		throw new Error("SESSION_SECRET is not set.");
	}

	return new TextEncoder().encode(secret);
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
