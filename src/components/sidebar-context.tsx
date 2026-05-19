"use client";

import * as React from "react";

/**
 * Coordinates the mobile sidebar drawer between the sidebar itself and the
 * page header's hamburger trigger. Above md (768px) the sidebar is always
 * mounted as a fixed rail and this state is unused.
 */
interface SidebarContextValue {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  toggleMobile: () => void;
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const value = React.useMemo<SidebarContextValue>(
    () => ({
      mobileOpen,
      setMobileOpen,
      toggleMobile: () => setMobileOpen((o) => !o),
    }),
    [mobileOpen],
  );
  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar() {
  const ctx = React.useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used inside SidebarProvider");
  return ctx;
}
