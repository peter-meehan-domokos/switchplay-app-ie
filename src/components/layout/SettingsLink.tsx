"use client";

import { createContext, useContext, type ReactNode } from "react";

/** Where the app menu's Settings item goes. Absent for websites that have no settings page, so their menu is unchanged. */
const SettingsLinkContext = createContext<string | undefined>(undefined);
export const useSettingsLink = () => useContext(SettingsLinkContext);
export function SettingsLinkProvider({ href, children }: Readonly<{ href: string | undefined; children: ReactNode }>) {
  return <SettingsLinkContext.Provider value={href}>{children}</SettingsLinkContext.Provider>;
}
