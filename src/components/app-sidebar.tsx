"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  LayoutDashboard, KanbanSquare, CalendarClock, Building2, Rocket,
  Settings, ChevronsLeft, ChevronsRight, LogOut,
  Search, Moon, Sun, Monitor,
} from "lucide-react";
import { useTheme } from "next-themes";
import { cn, initials } from "@/lib/utils";
import { useCurrentUser } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useSidebar } from "@/components/sidebar-context";

const nav = [
  { href: "/dashboard",  icon: LayoutDashboard, label: "Dashboard" },
  { href: "/pipeline",   icon: KanbanSquare,    label: "Pipeline" },
  { href: "/onboarding", icon: Rocket,          label: "Onboarding" },
  { href: "/companies",  icon: Building2,       label: "Companies" },
  { href: "/tasks",      icon: CalendarClock,   label: "Tasks" },
];

const SIDEBAR_KEY = "yaas.sidebar.collapsed";
const COLLAPSED_W = "72px";
const EXPANDED_W = "264px";

function applyWidth(collapsed: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--sb-w", collapsed ? COLLAPSED_W : EXPANDED_W);
}

export function AppSidebar() {
  const pathname = usePathname();
  const { mobileOpen, setMobileOpen } = useSidebar();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    const stored = typeof window !== "undefined" && localStorage.getItem(SIDEBAR_KEY);
    const next = stored === "1";
    setCollapsed(next);
    applyWidth(next);
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      } catch {}
      applyWidth(next);
      return next;
    });
  };

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "group/sidebar fixed inset-y-0 left-0 z-30 flex flex-col border-r transition-[width,transform] duration-200",
        "bg-[hsl(var(--sidebar-bg))] text-[hsl(var(--sidebar-fg))] border-[hsl(var(--sidebar-border))]",
        // Below md, the sidebar slides off-canvas unless the mobile drawer
        // is open. Above md, it's always pinned and `mobileOpen` is unused.
        "md:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        // On mobile the drawer takes the full viewport — easier tap targets
        // and clearer "you've opened the menu" focus state than a half-width
        // panel with a visible content edge behind it.
        collapsed ? "w-full md:w-[72px]" : "w-full md:w-[264px]"
      )}
    >
      {/* Mobile-only close affordance */}
      <button
        type="button"
        onClick={() => setMobileOpen(false)}
        aria-label="Close navigation"
        className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-md text-[hsl(var(--sidebar-muted))] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-fg))] md:hidden"
      >
        <X className="h-4 w-4" />
      </button>
      <Header collapsed={collapsed} onToggle={toggle} />

      <nav className={cn("mt-3 flex flex-1 flex-col gap-1 px-3", collapsed && "md:px-2")}>
        {nav.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname?.startsWith(item.href));
          const link = (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex h-10 items-center gap-3 rounded-md px-3 text-[13px] font-medium transition-colors",
                active
                  ? "bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-fg))]"
                  : "text-[hsl(var(--sidebar-muted))] hover:bg-[hsl(var(--sidebar-accent))]/60 hover:text-[hsl(var(--sidebar-fg))]",
                // Collapse styles only apply at md+ — on mobile the drawer is
                // always full-width and labels are visible.
                collapsed && "md:justify-center md:px-0"
              )}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span className={cn("truncate", collapsed && "md:sr-only")}>{item.label}</span>
            </Link>
          );
          return collapsed ? (
            <Tooltip key={item.href} delayDuration={0}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right" className="hidden md:block">{item.label}</TooltipContent>
            </Tooltip>
          ) : (
            link
          );
        })}
      </nav>

      {mounted && <AccountBlock collapsed={collapsed} />}
    </aside>
  );
}

function Header({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <div className={cn(
      "flex h-16 items-center border-b border-[hsl(var(--sidebar-border))] px-4",
      collapsed && "md:justify-center md:px-2",
    )}>
      <Link href="/dashboard" className="flex items-center gap-2.5 overflow-hidden">
        {/* Brand mark — PNG logo at /public/logo.png. Replace that file to
            swap the mark; dimensions and styling stay the same. */}
        <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-md bg-white shadow-sm">
          <Image src="/logo.png" alt="YAAS" width={36} height={36} className="h-full w-full object-contain" />
        </div>
        <div className={cn("flex flex-col leading-tight", collapsed && "md:hidden")}>
          <span className="text-[14px] font-semibold tracking-tight text-[hsl(var(--sidebar-fg))]">
            YAAS Sales CRM
          </span>
          <span className="text-[10px] uppercase tracking-[0.16em] text-[hsl(var(--sidebar-muted))]">
            Sales CRM
          </span>
        </div>
      </Link>
      {!collapsed && (
        <Button
          variant="ghost"
          size="icon-sm"
          // Desktop-only collapse trigger — mobile has its own close X.
          className="ml-auto hidden text-[hsl(var(--sidebar-muted))] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-fg))] md:inline-flex"
          onClick={onToggle}
          aria-label="Collapse sidebar"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
      )}
      {collapsed && (
        <Button
          variant="ghost"
          size="icon-sm"
          // The "peek out" expand pill is desktop-only — on mobile the drawer
          // is always wide, no pill needed.
          className="absolute right-[-12px] top-4 hidden h-6 w-6 rounded-full border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-bg))] text-[hsl(var(--sidebar-fg))] shadow-sm hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-fg))] md:flex"
          onClick={onToggle}
          aria-label="Expand sidebar"
        >
          <ChevronsRight className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

function AccountBlock({ collapsed }: { collapsed: boolean }) {
  const router = useRouter();
  const user = useCurrentUser();
  const { setTheme, theme } = useTheme();
  const { signOut } = useAuth();

  async function handleSignOut() {
    await signOut();
    toast("Signed out");
    router.replace("/login");
  }

  // The (app) layout gates rendering on auth, so this is defensive — the
  // momentary null happens only during the sign-out → redirect transition.
  if (!user) return null;

  return (
    <div className={cn(
      "mt-auto border-t border-[hsl(var(--sidebar-border))] p-3",
      collapsed && "md:p-2",
    )}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md p-2 text-left transition-colors hover:bg-[hsl(var(--sidebar-accent))]",
              collapsed && "md:justify-center md:p-1.5"
            )}
          >
            <Avatar className="h-9 w-9">
              {user.avatar_url ? <AvatarImage src={user.avatar_url} alt="" /> : null}
              {/* Avatar fits inside the navy palette — quiet "your account"
                  treatment, not a high-contrast logo mark. */}
              <AvatarFallback className="bg-[hsl(var(--sidebar-accent))] text-[11px] font-semibold text-[hsl(var(--sidebar-fg))]">
                {initials(user.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className={cn("min-w-0 flex-1 leading-tight", collapsed && "md:hidden")}>
              <div className="truncate text-[13px] font-medium text-[hsl(var(--sidebar-fg))]">
                {user.full_name}
              </div>
              <div className="truncate text-[11px] text-[hsl(var(--sidebar-muted))]">
                {user.email}
              </div>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-60">
          <DropdownMenuLabel className="flex items-center gap-2.5 px-2 pb-2 pt-1.5 normal-case">
            <Avatar className="h-8 w-8">
              {user.avatar_url ? <AvatarImage src={user.avatar_url} alt="" /> : null}
              <AvatarFallback className="bg-foreground text-[11px] font-semibold text-background">
                {initials(user.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[13px] font-semibold text-foreground">{user.full_name}</div>
              <div className="truncate text-[11px] text-muted-foreground">{user.email}</div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              {theme === "dark" ? <Moon /> : theme === "light" ? <Sun /> : <Monitor />}
              Theme
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => setTheme("light")}><Sun />Light</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")}><Moon />Dark</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")}><Monitor />System</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem asChild>
            <Link href="/settings"><Settings />Settings</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              handleSignOut();
            }}
            className="text-muted-foreground"
          >
            <LogOut />Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function CommandSearchButton() {
  return (
    <button className="hidden h-9 w-72 items-center gap-2 rounded-md border bg-background px-3 text-sm text-muted-foreground transition-colors hover:bg-accent md:flex">
      <Search className="h-4 w-4" />
      <span>Search leads, deals…</span>
      <span className="ml-auto rounded border bg-muted px-1.5 py-0.5 text-[10px] tracking-widest">⌘K</span>
    </button>
  );
}
