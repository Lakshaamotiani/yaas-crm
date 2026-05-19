"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLead, narrativeActivities } from "@/lib/store";
import { LeadSidebar } from "@/components/lead-detail/lead-sidebar";
import { SalesScript } from "@/components/lead-detail/sales-script";
import { ActivityTimeline } from "@/components/lead-detail/activity-timeline";
import { NotesComposer } from "@/components/lead-detail/notes-composer";
import { LeadActionBar } from "@/components/lead-detail/lead-action-bar";

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { lead, deal, qualification, activities } = useLead(params.id);
  // Show only narrative entries in the timeline — metadata edits get toast
  // undo at write time and live on the qualification/deal cards as the
  // current state, so they'd just clutter the story view.
  const visibleActivities = React.useMemo(() => narrativeActivities(activities), [activities]);

  if (!lead) {
    return (
      <div className="grid min-h-screen place-items-center px-6">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Lead not found.</p>
          <Button variant="ghost" size="sm" className="mt-4" onClick={() => router.push("/pipeline")}>
            <ArrowLeft /> Back to pipeline
          </Button>
        </div>
      </div>
    );
  }

  const startCall = (scriptId?: string) => {
    const qs = scriptId ? `?script=${encodeURIComponent(scriptId)}` : "";
    router.push(`/leads/${lead.id}/call${qs}`);
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* Slim back link — no entity name (the LeadSidebar already shows it).
          Click goes back to /pipeline (the canonical entry point for lead
          detail). Browser back also works; this is just an in-app shortcut. */}
      <div className="px-4 pt-3 sm:px-6 sm:pt-4">
        <Link
          href="/pipeline"
          className="inline-flex items-center gap-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Pipeline
        </Link>
      </div>

      {/* Mobile-only action bar — renders at the very top of the content
          stack (right under the breadcrumb), BEFORE the sidebar with the
          lead identity / qualification / deal info. On desktop this block
          is hidden; the action bar lives inside the main column instead. */}
      <div className="border-b p-4 md:hidden">
        <LeadActionBar leadId={lead.id} onLogCall={() => startCall()} />
      </div>

      {/* Two columns at md+. On mobile, items stack in this order:
          sidebar (identity / qualification / deal), then main content
          (script, notes, activity). The mobile-only action bar above
          handles the "actions first" need without competing for the
          desktop layout. */}
      <div className="grid flex-1 grid-cols-1 md:grid-cols-[320px_minmax(0,1fr)]">
        <LeadSidebar
          lead={lead}
          deal={deal}
          qualification={qualification}
        />

        <div className="flex min-w-0 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto p-4 scrollbar-thin sm:p-6">
            {/* Desktop-only action bar — sits at the top of the main column. */}
            <div className="hidden md:block">
              <LeadActionBar leadId={lead.id} onLogCall={() => startCall()} />
            </div>
            <SalesScript onUseInCall={(id) => startCall(id)} />
            <NotesComposer leadId={lead.id} />

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Activity
                </h2>
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {visibleActivities.length} entr{visibleActivities.length === 1 ? "y" : "ies"}
                </span>
              </div>
              <ActivityTimeline activities={visibleActivities} />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
