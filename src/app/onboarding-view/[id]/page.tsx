"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, CheckCircle2, Circle } from "lucide-react";
import { SERVICE_TYPE_LABEL } from "@/lib/constants";

const SESSION_KEY = "onboarding_view_token";

interface Lead { id: string; name: string; email: string | null; phone: string | null; service_type: string | null; company_id: string | null; }
interface Deal { id: string; lead_id: string; stage: string; value_mrr: number | null; value_one_time: number | null; value_currency: string; updated_at: string; }
interface Company { id: string; name: string; domain: string | null; }
interface Onboarding {
  lead_id: string;
  final_scope_of_work: string | null;
  number_of_videos: number | null;
  format: string | null;
  go_live_timeline: string | null;
  platform: string | null;
  team_required: string | null;
  operationalised: boolean | null;
  finance_team_looped_in: boolean | null;
  account_manager_assigned: boolean | null;
  first_video_live_link: string | null;
  briefing_doc_url: string | null;
  pitch_deck_url: string | null;
  proposal_doc_url: string | null;
  final_msa_url: string | null;
  signed_sow_url: string | null;
  po_first_invoice_url: string | null;
  final_int_brief_url: string | null;
  poc_name: string | null;
  whatsapp_number: string | null;
  email: string | null;
  next_action: string | null;
  next_action_date: string | null;
  daily_notes: string | null;
}

export default function OnboardingViewDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const leadId = params?.id ?? "";

  const [token, setToken] = React.useState<string | null>(null);
  const [lead, setLead] = React.useState<Lead | null>(null);
  const [company, setCompany] = React.useState<Company | null>(null);
  const [deal, setDeal] = React.useState<Deal | null>(null);
  const [onboarding, setOnboarding] = React.useState<Onboarding | null>(null);
  const [loading, setLoading] = React.useState(true);

  const loadData = React.useCallback((tok: string) => {
    fetch("/api/onboarding-view/data", {
      headers: { "x-onboarding-token": tok },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { router.replace("/onboarding-view"); return; }
        const l = (data.leads as Lead[]).find((x) => x.id === leadId);
        if (!l) { router.replace("/onboarding-view"); return; }
        setLead(l);
        setCompany(l.company_id ? (data.companies as Company[]).find((c) => c.id === l.company_id) ?? null : null);
        setDeal((data.deals as Deal[]).find((d) => d.lead_id === leadId) ?? null);
        setOnboarding((data.onboardings as Onboarding[]).find((o) => o.lead_id === leadId) ?? null);
      })
      .catch(() => router.replace("/onboarding-view"))
      .finally(() => setLoading(false));
  }, [leadId, router]);

  React.useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (!stored) { router.replace("/onboarding-view"); return; }
    setToken(stored);
    loadData(stored);
    const interval = setInterval(() => loadData(stored), 30_000);
    return () => clearInterval(interval);
  }, [loadData, router]);

  if (loading || !lead) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-[13px] text-muted-foreground animate-pulse">Loading…</p>
      </div>
    );
  }

  const o = onboarding ?? {} as Partial<Onboarding>;
  const checkpoints = [
    { label: "Operationalised",       done: !!o.operationalised },
    { label: "First video live",      done: !!o.first_video_live_link },
    { label: "Finance team looped in",done: !!o.finance_team_looped_in },
    { label: "Account manager assigned",done: !!o.account_manager_assigned },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <div className="border-b px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <Link
            href="/onboarding-view"
            className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-[17px] font-semibold tracking-tight">{company?.name ?? lead.name}</h1>
            <p className="text-[12px] text-muted-foreground">
              {lead.name}
              {lead.service_type ? ` · ${SERVICE_TYPE_LABEL[lead.service_type] ?? lead.service_type}` : ""}
            </p>
          </div>
          <span className="ml-auto rounded-md border bg-muted/30 px-2 py-0.5 text-[10px] text-muted-foreground uppercase tracking-wider">
            Read-only
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 p-4 sm:p-6 lg:grid-cols-[1fr_340px]">
        {/* Left */}
        <div className="space-y-5">
          <Section title="Final scope of work">
            <ReadField label="Scope">{o.final_scope_of_work ?? "—"}</ReadField>
            <div className="grid grid-cols-2 gap-3">
              <ReadField label="Number of videos">{o.number_of_videos ?? "—"}</ReadField>
              <ReadField label="Format">{o.format ?? "—"}</ReadField>
              <ReadField label="Go-live timeline">{o.go_live_timeline ?? "—"}</ReadField>
              <ReadField label="Platform">{o.platform ?? "—"}</ReadField>
            </div>
            <ReadField label="Team required">{o.team_required ?? "—"}</ReadField>
          </Section>

          <Section title="Ops checkpoints">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {checkpoints.map((c) => (
                <div key={c.label} className="flex items-center gap-2.5 rounded-md border bg-background p-2.5">
                  {c.done
                    ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                    : <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" />}
                  <div>
                    <div className="text-[12px] font-medium">{c.label}</div>
                  </div>
                </div>
              ))}
            </div>
            {o.first_video_live_link ? (
              <ReadField label="First video live link">
                <a href={o.first_video_live_link} target="_blank" rel="noreferrer"
                   className="inline-flex items-center gap-1 text-foreground underline underline-offset-2 hover:text-primary">
                  {o.first_video_live_link}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </ReadField>
            ) : null}
          </Section>

          {o.daily_notes ? (
            <Section title="Notes">
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-muted-foreground">{o.daily_notes}</p>
            </Section>
          ) : null}
        </div>

        {/* Right */}
        <div className="space-y-5">
          <Section title="Document trail">
            {[
              { label: "Briefing doc",    url: o.briefing_doc_url },
              { label: "Pitch deck",      url: o.pitch_deck_url },
              { label: "Final INT brief", url: o.final_int_brief_url },
            ].map(({ label, url }) => (
              <div key={label} className="flex items-center justify-between gap-2 text-[12px]">
                <span className="text-muted-foreground">{label}</span>
                {url
                  ? <a href={url} target="_blank" rel="noreferrer"
                       className="inline-flex items-center gap-1 text-foreground underline underline-offset-2 hover:text-primary">
                      Open <ExternalLink className="h-3 w-3" />
                    </a>
                  : <span className="text-muted-foreground/50">—</span>}
              </div>
            ))}
          </Section>

        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card">
      <header className="border-b px-4 py-3">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{title}</h2>
      </header>
      <div className="space-y-3 p-4">{children}</div>
    </section>
  );
}

function ReadField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-[13px]">{children}</p>
    </div>
  );
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span>{children}</span>
    </div>
  );
}
