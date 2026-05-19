"use client";

import { cn } from "@/lib/utils";
import { STAGE_TONE, type DealStage } from "@/lib/constants";
import { useStageMap } from "@/lib/store";

/**
 * Renders a deal stage from the live `pipeline_stages` config (label +
 * colour tone) so custom / renamed / recoloured stages show correctly
 * everywhere. Falls back to a humanized id if a deal somehow references a
 * stage that no longer exists (FK + delete-reassign should prevent it).
 */
export function StageChip({
  stage,
  className,
  dotOnly,
}: {
  stage: DealStage;
  className?: string;
  dotOnly?: boolean;
}) {
  const stageMap = useStageMap();
  const s = stageMap.get(stage);
  const dot = s ? STAGE_TONE[s.tone].dot : "bg-muted-foreground";
  const label = s?.label ?? humanize(stage);

  if (dotOnly) {
    return <span className={cn("inline-block h-1.5 w-1.5 rounded-full", dot, className)} />;
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border bg-card px-1.5 py-0.5 text-[11px] font-medium tracking-tight text-foreground/80",
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
      {label}
    </span>
  );
}

function humanize(id: string): string {
  return id.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
