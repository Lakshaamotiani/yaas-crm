"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Inbox, UserCheck, XCircle, Globe, Youtube, Phone, Mail, Briefcase, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useOverview, useProfiles, useActions, useStoreActivities } from "@/lib/store";
import { cn, relativeTime } from "@/lib/utils";
import { SERVICE_TYPE_LABEL } from "@/lib/constants";

const SALES_EMAILS = ["lakshaa@yaas.studio", "rashika@yaas.studio"];

export default function InboxPage() {
  const all = useOverview();
  const profiles = useProfiles();
  const actions = useActions();
  const activities = useStoreActivities();

  // Map lead_id → enrichment summary from system activities
  const enrichmentMap = React.useMemo(() => {
    const map = new Map<string, { summary: string; fit_score: number }>();
    for (const a of activities) {
      if ((a.metadata as any)?.kind === "enrichment") {
        map.set(a.lead_id, {
          summary: a.title ?? "",
          fit_score: (a.metadata as any).fit_score ?? 0,
        });
      }
    }
    return map;
  }, [activities]);

  // Unassigned leads only, newest first
  const inboxLeads = React.useMemo(
    () =>
      all
        .filter((l) => !l.owner_id)
        .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),
    [all],
  );

  // Sales POCs
  const salesPocs = React.useMemo(
    () => profiles.filter((p) => SALES_EMAILS.includes(p.email ?? "")),
    [profiles],
  );

  // Next up: the POC who got the fewest leads so far
  const nextUp = React.useMemo(() => {
    if (salesPocs.length < 2) return salesPocs[0] ?? null;
    const counts = salesPocs.map((p) => ({
      profile: p,
      count: all.filter((l) => l.owner_id === p.id).length,
    }));
    counts.sort((a, b) => a.count - b.count || SALES_EMAILS.indexOf(a.profile.email ?? "") - SALES_EMAILS.indexOf(b.profile.email ?? ""));
    return counts[0].profile;
  }, [all, salesPocs]);

  function assign(leadId: string, ownerId: string, ownerName: string) {
    actions.updateLead(leadId, { owner_id: ownerId });
    toast.success(`Assigned to ${ownerName}`);
  }

  function disqualify(leadId: string) {
    actions.updateLead(leadId, { status: "archived" as any });
    toast("Lead disqualified");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        title={
          <span className="inline-flex items-baseline gap-2.5">
            <span>Inbox</span>
            {inboxLeads.length > 0 && (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-mono text-[11px] tabular-nums text-amber-600 dark:text-amber-400">
                {inboxLeads.length} new
              </span>
            )}
          </span>
        }
        subtitle="Unassigned leads from Tally. Review, assign to a sales POC, or disqualify."
      />

      {/* Next-up bar */}
      {nextUp && inboxLeads.length > 0 && (
        <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2.5 sm:px-6">
          <ArrowRight className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-[12px] text-muted-foreground">
            Next up:{" "}
            <span className="font-medium text-foreground">{nextUp.full_name ?? nextUp.email}</span>
            {" "}—{" "}
            <span className="text-muted-foreground">
              {all.filter((l) => l.owner_id === nextUp.id).length} leads assigned so far
            </span>
          </span>
        </div>
      )}

      <div className="px-4 py-6 sm:px-6">
        {inboxLeads.length === 0 ? (
          <div className="grid place-items-center rounded-lg border bg-card py-20 text-center">
            <Inbox className="mb-3 h-8 w-8 text-muted-foreground/40" />
            <p className="text-[13px] font-medium">Inbox is empty</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              New Tally submissions will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {inboxLeads.map((lead) => {
              const additionalLines = lead.additional_info?.split("\n") ?? [];
              const serviceDisplay = lead.service_type
                ? SERVICE_TYPE_LABEL[lead.service_type] ?? lead.service_type
                : null;
              const enrichment = enrichmentMap.get(lead.id);

              return (
                <div
                  key={lead.id}
                  className="rounded-xl border bg-card p-4 transition-colors hover:border-foreground/20"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    {/* Lead info */}
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/leads/${lead.id}`}
                          className="text-[15px] font-semibold tracking-tight hover:underline"
                        >
                          {lead.company?.name ?? lead.name}
                        </Link>
                        {lead.company?.name && lead.name !== lead.company?.name && (
                          <span className="text-[12px] text-muted-foreground">{lead.name}</span>
                        )}
                        {serviceDisplay && (
                          <Badge variant="outline" className="text-[10px]">{serviceDisplay}</Badge>
                        )}
                        <span className="ml-auto text-[11px] text-muted-foreground" suppressHydrationWarning>
                          {relativeTime(lead.created_at)}
                        </span>
                      </div>

                      {/* AI enrichment verdict */}
                      {enrichment ? (
                        <div className={cn(
                          "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium",
                          enrichment.fit_score >= 50
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                            : enrichment.fit_score >= 25
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                            : "bg-muted text-muted-foreground",
                        )}>
                          {enrichment.summary}
                        </div>
                      ) : (
                        <div className="text-[11px] text-muted-foreground/50 italic">
                          Analysing company…
                        </div>
                      )}

                      {/* Contact details */}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
                        {lead.role && (
                          <span className="flex items-center gap-1">
                            <Briefcase className="h-3 w-3" />{lead.role}
                          </span>
                        )}
                        {lead.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />{lead.email}
                          </span>
                        )}
                        {lead.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />{lead.phone}
                          </span>
                        )}
                        {lead.company?.domain && (
                          <span className="flex items-center gap-1">
                            <Globe className="h-3 w-3" />{lead.company.domain}
                          </span>
                        )}
                      </div>

                      {/* Additional info lines (service interest, YouTube) */}
                      {additionalLines.length > 0 && (
                        <div className="space-y-0.5">
                          {additionalLines.map((line, i) => (
                            <p key={i} className="text-[12px] text-muted-foreground">{line}</p>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                      {salesPocs.map((poc) => (
                        <Button
                          key={poc.id}
                          size="sm"
                          variant={poc.id === nextUp?.id ? "default" : "outline"}
                          className="gap-1.5 text-[12px]"
                          onClick={() => assign(lead.id, poc.id, poc.full_name ?? poc.email ?? "")}
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          {poc.full_name?.split(" ")[0] ?? poc.email}
                        </Button>
                      ))}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5 text-[12px] text-muted-foreground hover:text-destructive"
                        onClick={() => disqualify(lead.id)}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Disqualify
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
