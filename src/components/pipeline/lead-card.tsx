"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Building2, Sparkles, GripVertical, Youtube } from "lucide-react";
import { cn, initials, formatMoney, relativeTime } from "@/lib/utils";
import type { LeadOverview } from "@/lib/types";

export function LeadCard({
  lead,
  dragging,
  innerRef,
  attributes,
  listeners,
  style,
}: {
  lead: LeadOverview;
  dragging?: boolean;
  innerRef?: (el: HTMLElement | null) => void;
  attributes?: Record<string, any>;
  listeners?: Record<string, any>;
  style?: React.CSSProperties;
}) {
  const router = useRouter();
  const href = `/leads/${lead.id}`;
  const downRef = React.useRef<{ x: number; y: number } | null>(null);

  const primaryTag = lead.tags[0];
  const extraTags = Math.max(0, lead.tags.length - 1);
  const mrr = lead.value_mrr && lead.value_mrr > 0 ? lead.value_mrr : null;
  const highFit = typeof lead.fit_score === "number" && lead.fit_score >= 80;
  const companyName = lead.company?.name ?? null;
  const hasYouTube = !!lead.company?.links?.some((l) => l.type === "youtube");

  return (
    <a
      ref={innerRef as any}
      href={href}
      style={style}
      {...attributes}
      {...listeners}
      onPointerDown={(e) => {
        downRef.current = { x: e.clientX, y: e.clientY };
        listeners?.onPointerDown?.(e);
      }}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
        const start = downRef.current;
        if (start) {
          const dx = Math.abs(e.clientX - start.x);
          const dy = Math.abs(e.clientY - start.y);
          if (dx > 4 || dy > 4) { e.preventDefault(); return; }
        }
        e.preventDefault();
        router.push(href);
      }}
      className={cn(
        "group block cursor-pointer rounded-lg border bg-card p-2.5 text-card-foreground no-underline shadow-[0_1px_0_0_rgba(0,0,0,0.02)] outline-none transition-[box-shadow,border-color] focus-visible:ring-1 focus-visible:ring-ring",
        dragging
          ? "shadow-md ring-1 ring-foreground/15"
          : "hover:border-foreground/20",
      )}
    >
      <div className="flex items-start gap-2.5">
        <Avatar className="h-7 w-7">
          <AvatarFallback className="bg-muted text-[10px] font-medium">
            {initials(lead.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="truncate text-[13px] font-medium tracking-tight">{lead.name}</span>
            {highFit ? <Sparkles className="h-3 w-3 shrink-0 text-amber-500" /> : null}
          </div>
          {companyName ? (
            <div className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
              <Building2 className="h-3 w-3 shrink-0" />
              <span className="truncate">{companyName}</span>
            </div>
          ) : null}
        </div>
        <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/30 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>

      {(mrr || primaryTag || hasYouTube) ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {mrr ? (
            <Badge variant="muted" className="font-mono text-[10px] tabular-nums">
              {formatMoney(mrr, lead.value_currency, { compact: true })}/mo
            </Badge>
          ) : null}
          {hasYouTube ? (
            <Badge variant="muted" className="gap-1 px-1.5 text-[10px]">
              <Youtube className="h-3 w-3" />
              YT
            </Badge>
          ) : null}
          {primaryTag ? (
            <Badge variant="outline" className="text-[10px]">{primaryTag}</Badge>
          ) : null}
          {extraTags > 0 ? (
            <span className="text-[10px] tabular-nums text-muted-foreground">+{extraTags}</span>
          ) : null}
        </div>
      ) : null}

      <div className="mt-2 flex items-center justify-end text-[10px] text-muted-foreground">
        <span className="tabular-nums" suppressHydrationWarning>{relativeTime(lead.updated_at)}</span>
      </div>
    </a>
  );
}
