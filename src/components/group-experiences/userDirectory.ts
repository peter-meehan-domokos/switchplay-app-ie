"use client";
import { useSyncExternalStore } from "react";
export type DirectoryUser = { id: string; name: string };
type DirectoryState = { users?: DirectoryUser[]; loading: boolean; error?: string };
// Fetch timing is independent of the form: a future shell may call ensure()
// early. Cache and in-flight identity are scoped to the authenticated actor.
export function createUserDirectory(request: typeof fetch = (...args) => fetch(...args)) {
  const entries = new Map<string, { state: DirectoryState; listeners: Set<() => void>; pending?: Promise<DirectoryUser[]> }>();
  function entry(actor: string) {
    let value = entries.get(actor);
    if (!value) { value = { state: { loading: false }, listeners: new Set() }; entries.set(actor, value); }
    return value;
  }
  function publish(actor: string, state: DirectoryState) { const value = entry(actor); value.state = state; value.listeners.forEach(fn => fn()); }
  async function assertActor(actor: string) {
    const response = await request("/api/auth/me", { cache: "no-store" });
    if (!response.ok || (await response.json()).user?.id !== actor) throw Error("Your sign-in changed. Reload before selecting users.");
  }
  return {
    snapshot: (actor: string) => entry(actor).state,
    subscribe(actor: string, listener: () => void) { const value = entry(actor); value.listeners.add(listener); return () => { value.listeners.delete(listener); }; },
    ensure(actor: string) {
      const value = entry(actor); if (value.pending) return value.pending;
      publish(actor, { ...value.state, loading: !value.state.users, error: undefined });
      value.pending = (async () => {
        try {
          await assertActor(actor);
          if (value.state.users) return value.state.users;
          const response = await request("/api/users", { cache: "no-store" });
          if (!response.ok) throw Error("Unable to load registered users. Please retry.");
          const body = await response.json(); await assertActor(actor);
          if (!Array.isArray(body.users) || body.users.some((row: DirectoryUser) => !row || typeof row.id !== "string" || typeof row.name !== "string")) throw Error("Invalid user directory.");
          const users = (body.users as DirectoryUser[]).map(({ id, name }) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || a.id.localeCompare(b.id));
          publish(actor, { users, loading: false }); return users;
        } catch (error) { publish(actor, { loading: false, error: error instanceof Error ? error.message : "Unable to load users." }); throw error; }
        finally { value.pending = undefined; }
      })();
      return value.pending;
    },
  };
}
const directory = createUserDirectory();
export const ensureUserDirectory = directory.ensure;
export function useUserDirectory(actor: string) {
  return useSyncExternalStore(listener => directory.subscribe(actor, listener), () => directory.snapshot(actor), () => directory.snapshot(actor));
}
