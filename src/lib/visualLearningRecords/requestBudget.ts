/** Bounded process-local protection. Deployment-wide abuse controls remain a release review item. */
export function createVisualRequestBudget(now = () => Date.now(), limit = 120, capacity = 10000) {
  const windows = new Map<string, { expires: number; used: number }>();
  return (principal: string): boolean => {
    const time = now(), old = windows.get(principal);
    if (old && old.expires > time) { if (old.used >= limit) return false; old.used++; return true; }
    for (const [key, window] of windows) if (window.expires <= time) windows.delete(key);
    if (windows.size >= capacity) return false;
    windows.set(principal, { expires: time + 60000, used: 1 }); return true;
  };
}
