"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";

const sections = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/workspace", label: "Workspace" },
  { href: "/settings/api", label: "API & Integrations" },
  { href: "/settings/notifications", label: "Notifications" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader title="Settings" subtitle="Manage your account and workspace" />
      <div className="grid flex-1 grid-cols-1 gap-0 md:grid-cols-[220px_1fr]">
        {/* Settings nav: horizontal scroll-strip on mobile, vertical rail
            on desktop. Bottom border on mobile reads as a section divider
            (right border would be confusing at full width). */}
        <nav className="border-b p-2 md:border-b-0 md:border-r md:p-4">
          <ul className="-mx-1 flex gap-1 overflow-x-auto px-1 no-scrollbar md:mx-0 md:flex-col md:gap-0 md:space-y-0.5 md:overflow-visible md:px-0">
            {sections.map((s) => {
              const active = pathname === s.href;
              return (
                <li key={s.href} className="shrink-0 md:shrink">
                  <Link
                    href={s.href}
                    className={cn(
                      "flex h-8 items-center whitespace-nowrap rounded-md px-3 text-sm transition-colors md:px-2",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                    )}
                  >
                    {s.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
