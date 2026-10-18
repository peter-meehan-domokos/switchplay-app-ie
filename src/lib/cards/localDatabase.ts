// Phase 2 is a local vertical slice, not a production cutover. Check before connecting.
export function assertDisposableDatabase(uri = process.env.MONGODB_URI, name = process.env.MONGODB_DB) {
  if (!uri || !name || !/^switchplay_(phase2|test|migration)_[a-zA-Z0-9_-]+$/.test(name)) {
    throw new Error("Phase 2 requires an explicitly named disposable local database.");
  }
  if (!uri.startsWith("mongodb://")) throw new Error("Phase 2 refuses remote MongoDB connections.");
  const authority = uri.slice("mongodb://".length).split("/")[0];
  if (authority.includes("@") || !authority.split(",").every((host) => /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host))) {
    throw new Error("Phase 2 refuses remote MongoDB connections.");
  }
}
