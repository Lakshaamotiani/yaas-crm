"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { ForcePasswordChange } from "@/components/profile/force-password-change";
import { SidebarProvider, useSidebar } from "@/components/sidebar-context";
import { useAuth } from "@/lib/auth";

/** If auth doesn't resolve in this many ms, assume something's wrong (e.g.
 *  stale cookie pointing at a deleted user) and bounce to /login rather than
 *  letting the user stare at a black screen forever. */
const AUTH_RESOLVE_TIMEOUT_MS = 5000;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [authTimedOut, setAuthTimedOut] = React.useState(false);

  React.useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setAuthTimedOut(true), AUTH_RESOLVE_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [loading]);

  React.useEffect(() => {
    const shouldBounce = (!loading && !user) || authTimedOut;
    if (!shouldBounce) return;
    const next = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
    router.replace(`/login${next}`);
  }, [loading, user, pathname, router, authTimedOut]);

  if (loading || !user) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <SidebarProvider>
      <AppShell>{children}</AppShell>
    </SidebarProvider>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const { mobileOpen, setMobileOpen } = useSidebar();
  const pathname = usePathname();

  // Auto-close the mobile drawer on every navigation. Without this, tapping
  // a nav item leaves the drawer open over the next page.
  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />

      {/* Backdrop — mobile only, dismisses the drawer on tap */}
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-[2px] md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      ) : null}

      <div
        className="min-h-screen transition-[padding] duration-200 md:pl-[var(--sb-w,264px)]"
      >
        <MobileAppBar />
        <main className="min-h-screen">{children}</main>
      </div>

      <ForcePasswordChange />
    </div>
  );
}

/**
 * Persistent mobile-only top bar: hamburger + branded YAAS mark. Visible on
 * every (app) route so the sidebar is always one tap away, no matter how
 * deep you've drilled (lead detail, settings sub-page, call screen, etc.).
 * Hidden on md+, where the pinned sidebar provides the same affordance.
 */
function MobileAppBar() {
  const { toggleMobile } = useSidebar();
  return (
    <header className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/75 md:hidden">
      <button
        type="button"
        onClick={toggleMobile}
        aria-label="Open navigation"
        className="-ml-1 grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Menu className="h-4 w-4" />
      </button>
      <Link
        href="/dashboard"
        aria-label="YAAS Sales CRM — go to dashboard"
        className="flex items-center gap-2"
      >
        <div className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-md bg-white shadow-sm">
          <Image src="/logo.png" alt="YAAS" width={28} height={28} className="h-full w-full object-contain" />
        </div>
        <span className="text-[13px] font-semibold tracking-tight">YAAS Sales CRM</span>
      </Link>
    </header>
  );
}
