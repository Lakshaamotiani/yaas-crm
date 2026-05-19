"use client";

import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-b bg-background/80 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-6 sm:py-4",
        className,
      )}
    >
      {/* Title + actions always on one row — actions sit to the right even
          on mobile so the user doesn't have to scroll past a stacked layout
          to reach Add Lead / Add Company / date range. */}
      <div className="flex items-center gap-3">
        <h1 className="min-w-0 flex-1 truncate text-[17px] font-semibold tracking-tight">
          {title}
        </h1>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
      {subtitle ? (
        <p className="mt-1 truncate text-[12px] text-muted-foreground">{subtitle}</p>
      ) : null}
    </div>
  );
}
