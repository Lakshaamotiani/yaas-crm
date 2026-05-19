"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Search, Building2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useCompaniesOverview, useActions, useStageLabels } from "@/lib/store";
import { cn, formatCurrency, initials, relativeTime } from "@/lib/utils";
import { PRIORITY_LEVELS, type PriorityLevel } from "@/lib/constants";

const PRIORITY_TONE: Record<PriorityLevel, string> = {
  high:   "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-300",
  medium: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-300",
  low:    "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-300",
};

export default function CompaniesPage() {
  const rows = useCompaniesOverview();
  const stageLabels = useStageLabels();
  const actions = useActions();
  const [query, setQuery] = React.useState("");

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter(({ company }) => {
        if (!q) return true;
        const hay = [
          company.name,
          company.domain,
          company.industry,
          ...(company.tags ?? []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        // Companies with activity first (newest activity wins), then alpha.
        const aT = a.latestActivity ? +new Date(a.latestActivity) : 0;
        const bT = b.latestActivity ? +new Date(b.latestActivity) : 0;
        if (aT !== bT) return bT - aT;
        return a.company.name.localeCompare(b.company.name);
      });
  }, [rows, query]);

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        title={
          <span className="inline-flex items-baseline gap-2.5">
            <span>Companies</span>
            <span className="font-mono text-[12px] tabular-nums font-normal text-muted-foreground">
              {visible.length}
            </span>
          </span>
        }
        subtitle="Accounts you sell to. Each company can have multiple contacts over time."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/companies/new"><Plus /> Add Company</Link>
          </Button>
        }
      />

      <div className="flex items-center gap-2 border-b px-4 py-3 sm:px-6">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search companies, domains, tags…"
            className="h-8 w-full pl-8 text-sm"
          />
        </div>
      </div>

      <div className="px-4 py-6 sm:px-6">
        {/* Desktop table */}
        <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
          <table className="w-full text-[13px]">
            <thead className="bg-muted/30 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              <tr>
                <Th className="w-[32%]">Company</Th>
                <Th>Contacts</Th>
                <Th>Open deals</Th>
                <Th>Deal value</Th>
                <Th>Stage</Th>
                <Th>Priority</Th>
                <Th className="text-right">Latest activity</Th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visible.map(({ company, contactsCount, openDeals, dealValue, latestStage, latestActivity }) => (
                <tr key={company.id} className="group hover:bg-accent/40">
                  <Td>
                    <Link href={`/companies/${company.id}`} className="flex items-center gap-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md border bg-muted text-[11px] font-medium">
                        {initials(company.name) || <Building2 className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-medium tracking-tight">{company.name}</div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {company.domain ?? company.industry ?? "—"}
                          {company.tags.length > 0 ? (
                            <span className="ml-2 inline-flex items-center gap-1">
                              {company.tags.slice(0, 3).map((t) => (
                                <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                              ))}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </Link>
                  </Td>
                  <Td>
                    <span className="font-mono text-xs tabular-nums">{contactsCount}</span>
                  </Td>
                  <Td>
                    <span className={cn(
                      "font-mono text-xs tabular-nums",
                      openDeals === 0 && "text-muted-foreground",
                    )}>
                      {openDeals}
                    </span>
                  </Td>
                  <Td>
                    <span className={cn(
                      "font-mono text-xs tabular-nums",
                      dealValue === 0 && "text-muted-foreground",
                    )}>
                      {dealValue > 0 ? formatCurrency(dealValue, { compact: true }) : "—"}
                    </span>
                  </Td>
                  <Td>
                    {latestStage ? (
                      <Badge variant="outline" className="text-[10px]">
                        {stageLabels[latestStage] ?? latestStage}
                      </Badge>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">—</span>
                    )}
                  </Td>
                  <Td>
                    <Select
                      value={company.priority ?? ""}
                      onValueChange={(v) =>
                        actions.updateCompany(company.id, { priority: (v || null) as PriorityLevel | null })
                      }
                    >
                      <SelectTrigger className={cn(
                        "h-7 w-[100px] text-xs",
                        company.priority && PRIORITY_TONE[company.priority],
                      )}>
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITY_LEVELS.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Td>
                  <Td className="text-right text-xs text-muted-foreground">
                    <span suppressHydrationWarning>
                      {latestActivity ? relativeTime(latestActivity) : "—"}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 ? (
            <div className="grid place-items-center py-12 text-center text-[13px] text-muted-foreground">
              {rows.length === 0 ? (
                <>
                  <p>No companies yet.</p>
                  <Button variant="outline" size="sm" className="mt-3" asChild>
                    <Link href="/companies/new"><Plus /> Add the first one</Link>
                  </Button>
                </>
              ) : (
                <p>No companies match this search.</p>
              )}
            </div>
          ) : null}
        </div>

        {/* Mobile card stack */}
        <ul className="divide-y rounded-lg border bg-card md:hidden">
          {visible.length === 0 ? (
            <li className="px-4 py-12 text-center text-[13px] text-muted-foreground">
              {rows.length === 0 ? (
                <div>
                  <p>No companies yet.</p>
                  <Button variant="outline" size="sm" className="mt-3" asChild>
                    <Link href="/companies/new"><Plus /> Add the first one</Link>
                  </Button>
                </div>
              ) : (
                <p>No companies match this search.</p>
              )}
            </li>
          ) : (
            visible.map(({ company, contactsCount, openDeals, dealValue, latestStage, latestActivity }) => (
              <li key={company.id}>
                <Link href={`/companies/${company.id}`} className="block px-3.5 py-3 active:bg-accent">
                  <div className="flex items-start gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md border bg-muted text-[11px] font-medium">
                      {initials(company.name) || <Building2 className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-[14px] font-medium tracking-tight">{company.name}</div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            {company.domain ?? company.industry ?? "—"}
                          </div>
                        </div>
                        <span
                          className="shrink-0 text-[10px] text-muted-foreground"
                          suppressHydrationWarning
                        >
                          {latestActivity ? relativeTime(latestActivity) : "—"}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] tabular-nums text-muted-foreground">
                        <span>
                          <span className="text-foreground">{contactsCount}</span>{" "}
                          {contactsCount === 1 ? "contact" : "contacts"}
                        </span>
                        <span>
                          <span className={cn(openDeals === 0 ? "text-muted-foreground" : "text-foreground")}>
                            {openDeals}
                          </span>{" "}
                          open
                        </span>
                        <span>
                          <span className={cn(dealValue === 0 ? "text-muted-foreground" : "text-foreground")}>
                            {dealValue > 0 ? formatCurrency(dealValue, { compact: true }) : "—"}
                          </span>{" "}
                          deal value
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {latestStage ? (
                          <Badge variant="outline" className="text-[10px]">
                            {stageLabels[latestStage] ?? latestStage}
                          </Badge>
                        ) : null}
                        {company.priority ? (
                          <Badge
                            variant="outline"
                            className={cn("text-[10px]", PRIORITY_TONE[company.priority])}
                          >
                            {company.priority}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            ))
          )}
        </ul>
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
