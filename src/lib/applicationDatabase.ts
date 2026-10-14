import { assertDisposableDatabase } from "./cards/localDatabase";

// Production access is deliberate. NODE_ENV alone must never enable Atlas.
export function assertProductionDatabase(uri: string | undefined, database: string | undefined, host: string | undefined) {
  if (!uri || database !== "switchplay" || !host || !/^[a-z0-9.-]+\.mongodb\.net$/i.test(host)) {
    throw new Error("Explicit switchplay Atlas database and host required.");
  }
  let parsed: URL;
  try { parsed = new URL(uri); } catch { throw new Error("Invalid Atlas configuration."); }
  // MongoDB option names are case-insensitive. Inspect every supplied value so
  // alternate casing cannot bypass the TLS requirements.
  const insecureTls = [...parsed.searchParams].some(([name, value]) => {
    const option = name.toLowerCase(), setting = value.toLowerCase();
    return ["tls", "ssl"].includes(option) && setting === "false"
      || ["tlsallowinvalidcertificates", "tlsallowinvalidhostnames", "tlsinsecure"].includes(option) && setting === "true";
  });
  if (parsed.protocol !== "mongodb+srv:" || parsed.hostname.toLowerCase() !== host.toLowerCase()
    || parsed.port || !["", "/", "/switchplay"].includes(parsed.pathname)
    || insecureTls) {
    throw new Error("Atlas connection does not match the approved switchplay configuration.");
  }
}

export function assertApplicationDatabase(env: Record<string, string | undefined> = process.env) {
  const mode = env.SWITCHPLAY_DATABASE_MODE ?? "disposable";
  if (mode === "disposable") return assertDisposableDatabase(env.MONGODB_URI, env.MONGODB_DB);
  if (mode !== "production") throw new Error("Unknown application database mode.");
  if (env.PHASE2_BROWSER_TEST === "1" || env.PHASE2_MEDIA_FIXTURE_ORIGIN || env.NEXT_PUBLIC_PHASE2_MOCK_MEDIA === "1") {
    throw new Error("Production refuses disposable media settings.");
  }
  if (env.NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA !== "1") throw new Error("Production requires protected media delivery.");
  assertProductionDatabase(env.MONGODB_URI, env.MONGODB_DB, env.SWITCHPLAY_ATLAS_HOST);
}
