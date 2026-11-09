import type { SiteId } from "./siteResolver";

// Brand data for the shared /login page only. Each website folder keeps its own independent copy of its brand.
export const siteBrands = {
  strat17: { name: "Strat17", titleName: "STRAT17", supportEmail: "info@strat17.com", brandLead: "STRAT", brandTail: "17" },
  puckle: { name: "Puckle", titleName: "PUCKLE", supportEmail: "info@puckle.co", brandLead: "PUCKLE", brandTail: "" },
  switchplay: { name: "Switchplay", titleName: "SWITCHPLAY", supportEmail: "info@switchplay.ie", brandLead: "SWITCH", brandTail: "PLAY" },
} as const satisfies Record<SiteId, { name: string; titleName: string; supportEmail: string; brandLead: string; brandTail: string }>;
