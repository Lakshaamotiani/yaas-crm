"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { renderTokens } from "@/lib/script-runtime";
import type { CaptureField } from "@/lib/constants";

/**
 * Renders text with {{token}} substitutions. Filled tokens are highlighted as
 * pills; empty tokens render as a clearly visible "—" placeholder so the rep
 * sees the gap they need to fill.
 */
export function TokenText({
  text,
  context,
  fields,
  className,
}: {
  text: string;
  context: Record<string, unknown>;
  fields: Record<string, CaptureField>;
  className?: string;
}) {
  const parts = React.useMemo(
    () => renderTokens(text, context, fields),
    [text, context, fields],
  );

  return (
    <div className={cn("whitespace-pre-wrap text-[14px] leading-relaxed", className)}>
      {parts.map((p, i) => {
        if (p.kind === "text") return <React.Fragment key={i}>{p.text}</React.Fragment>;
        return (
          <span
            key={i}
            data-token={p.raw}
            className={cn(
              "mx-[1px] inline-flex items-baseline rounded px-1.5 py-0.5 font-mono text-[12.5px] tabular-nums tracking-tight",
              p.filled
                // Filled — soft blue pill. Distinct from the navy chrome
                // but in the same family, reads as "this value came from
                // captured data." Works in both light and dark.
                ? "bg-blue-500/10 font-semibold text-blue-700 ring-1 ring-blue-500/20 dark:bg-blue-500/[0.14] dark:text-blue-300 dark:ring-blue-500/30"
                // Empty — louder amber pill that demands the rep's attention.
                : "bg-amber-500/10 italic text-amber-700 ring-1 ring-amber-500/20 dark:text-amber-400"
            )}
            title={p.raw}
          >
            {p.text}
          </span>
        );
      })}
    </div>
  );
}
