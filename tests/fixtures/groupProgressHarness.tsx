import { createRoot } from "react-dom/client";
import { AppRouterContext, type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import ProgressShell from "../../src/components/progress/ProgressShell";
import type {} from "./groupProgressAdapter";

// Only the fixture bundle supplies the Next router context outside a Next page.
// Navigation is not a prototype of future Group Progress destinations.
const router: AppRouterInstance = {
  back: () => window.history.back(), forward: () => window.history.forward(), refresh: () => window.location.reload(),
  push: href => window.location.assign(href), replace: href => window.location.replace(href), prefetch() {},
};
const fixture = window.groupProgressPreview;
createRoot(document.getElementById("fixture")!).render(<AppRouterContext.Provider value={router}>
  <ProgressShell currentUserId={fixture.actor} userName={`${fixture.name} — fixture only`} />
</AppRouterContext.Provider>);
