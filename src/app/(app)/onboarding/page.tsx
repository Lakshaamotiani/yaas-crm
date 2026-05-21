"use client";

import * as React from "react";
import Link from "next/link";
import { Search, Rocket, CheckCircle2, Circle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useOnboardingOverview, useStageLabels } from "@/lib/store";
import { cn, initials, relativeTime } from "@/lib/utils";
import { SERVICE_TYPE_LABEL } from "@/lib/constants";

export default function OnboardingPage() {
  const rows = useOnboardingOverview();
  const stageLabels = useStageLabels();
  const [query, setQuery] = React.useState("");

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(({ lead, company }) => {
      const hay = [
        lead.name, lead.email, lead.phone,
        company?.name, company?.domain,
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query]);

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        title={
          <span className="inline-flex items-baseline gap-2.5">
            <span>Onboarding</span>
            <span className="font-mono text-[12px] tabular-nums font-normal text-muted-foreground">
              {visible.length}
            </span>
          </span>
        }
        subtitle="Operationalisation sheet for closed deals. Track final scope, ops checkpoints, and document trail."
      />

      <div className="flex items-center gap-2 border-b px-4 py-3 sm:px-6">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search brand, contact, email…"
            className="h-8 w-full pl-8 text-sm"
          />
        </div>
      </div>

      <div className="px-4 py-6 sm:px-6">
        {visible.length === 0 ? (
          <div className="grid place-items-center rounded-lg border bg-card py-16 text-center">
            <Rocket className="mb-3 h-8 w-8 text-muted-foreground/40" />
            <p className="text-[13px] font-medium">
              {rows.length === 0 ? "Nothing in onboarding yet." : "No brands match this search."}
            </p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {rows.length === 0
                ? "Deals appear here once they reach a closed-won stage."
                : "Try a different search."}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
              <table className="w-full text-[13px]">
                <thead className="bg-muted/30 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                  <tr>
                    <Th className="w-[28%]">Brand / Contact</Th>
                    <Th>Service</Th>
                    <Th>Stage</Th>
                    <Th>Ops checkpoints</Th>
                    <Th>Go live timeline</Th>
                    <Th className="text-right">Updated</Th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {visible.map(({ lead, company, deal, onboarding }) => {
                    const checkpoints = [
                      { label: "Operationalised",      done: !!onboarding?.operationalised },
                      { label: "First video live",     done: !!onboarding?.first_video_live_link },
                      { label: "Finance looped",       done: !!onboarding?.finance_team_looped_in },
                      { label: "Account manager",      done: !!onboarding?.account_manager_assigned },
                    ];
                    const doneCount = checkpoints.filter((c) => c.done).length;
                    return (
                      <tr key={lead.id} className="group hover:bg-accent/40">
                        <Td>
                          <Link href={`/onboarding/${lead.id}`} className="flex items-center gap-3">
                            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md border bg-muted text-[11px] font-medium">
                              {initials(company?.name ?? lead.name)}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate font-medium tracking-tight">
                                {company?.name ?? lead.name}
                              </div>
                              <div className="truncate text-[11px] text-muted-foreground">
                                {lead.name}{lead.email ? ` · ${lead.email}` : ""}
                              </div>
                            </div>
                          </Link>
                        </Td>
                        <Td>
                          <span className="text-[12px]">
                            {lead.service_type
                              ? SERVICE_TYPE_LABEL[lead.service_type] ?? lead.service_type
                              : <span className="text-muted-foreground">—</span>}
                          </span>
                        </Td>
                        <Td>
                          {deal?.stage ? (
                            <Badge variant="outline" className="text-[10px]">
                              {stageLabels[deal.stage] ?? deal.stage}
                            </Badge>
                          ) : <span className="text-[11px] text-muted-foreground">—</span>}
                        </Td>
                        <Td>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                              {doneCount}/4
                            </span>
                            <div className="flex gap-0.5">
                              {checkpoints.map((c, i) => (
                                <span key={i} title={c.label}>
                                  {c.done ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                  ) : (
                                    <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />
                                  )}
                                </span>
                              ))}
                            </div>
                          </div>
                        </Td>
                        <Td>
                          <div className="truncate text-[12px]">
                            {onboarding?.go_live_timeline ?? <span className="text-muted-foreground">—</span>}
                          </div>
                        </Td>
                        <Td className="text-right text-xs text-muted-foreground">
                          <span suppressHydrationWarning>
                            {deal ? relativeTime(deal.updated_at) : "—"}
                          </span>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile card stack */}
            <ul className="divide-y rounded-lg border bg-card md:hidden">
              {visible.map(({ lead, company, deal, onboarding }) => {
                const checkpoints = [
                  !!onboarding?.operationalised,
                  !!onboarding?.first_video_live_link,
                  !!onboarding?.finance_team_looped_in,
                  !!onboarding?.account_manager_assigned,
                ];
                const doneCount = checkpoints.filter(Boolean).length;
                return (
                  <li key={lead.id}>
                    <Link href={`/onboarding/${lead.id}`} className="block px-3.5 py-3 active:bg-accent">
                      <div className="flex items-start gap-3">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md border bg-muted text-[11px] font-medium">
                          {initials(company?.name ?? lead.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-[14px] font-medium tracking-tight">
                                {company?.name ?? lead.name}
                              </div>
                              <div className="truncate text-[11px] text-muted-foreground">
                                {lead.name}
                              </div>
                            </div>
                            {deal?.stage ? (
                              <Badge variant="outline" className="shrink-0 text-[10px]">
                                {stageLabels[deal.stage] ?? deal.stage}
                              </Badge>
                            ) : null}
                          </div>
                          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                            <span className="truncate">
                              {lead.service_type
                                ? SERVICE_TYPE_LABEL[lead.service_type] ?? lead.service_type
                                : "—"}
                            </span>
                            <span className="font-mono tabular-nums">{doneCount}/4 ops</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 py-2 text-left font-medium", className)}>{children}</th>;
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-2.5 align-middle", className)}>{children}</td>;
}
