"use client";

import * as React from "react";
import Link from "next/link";
import { Eye, EyeOff, Rocket, CheckCircle2, Circle, Search, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { SERVICE_TYPE_LABEL } from "@/lib/constants";

// ---------- Types ----------

interface Lead { id: string; name: string; email: string | null; phone: string | null; service_type: string | null; company_id: string | null; }
interface Deal { id: string; lead_id: string; stage: string; value_mrr: number | null; updated_at: string; }
interface Company { id: string; name: string; domain: string | null; }
interface Onboarding {
  lead_id: string;
  operationalised: boolean | null;
  first_video_live_link: string | null;
  finance_team_looped_in: boolean | null;
  account_manager_assigned: boolean | null;
  go_live_timeline: string | null;
}

interface Row { lead: Lead; company: Company | null; deal: Deal | null; onboarding: Onboarding | null; }

const SESSION_KEY = "onboarding_view_token";

// ---------- Password gate ----------

function PasswordGate({ onUnlock }: { onUnlock: (pwd: string) => void }) {
  const [pwd, setPwd] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding-view/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwd }),
      });
      if (res.ok) {
        sessionStorage.setItem(SESSION_KEY, pwd);
        onUnlock(pwd);
      } else {
        setError("Incorrect password. Try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl border bg-card">
            <Lock className="h-5 w-5 text-muted-foreground" />
          </div>
          <h1 className="text-[18px] font-semibold tracking-tight">Onboarding view</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">Enter the access password to continue.</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div className="relative">
            <input
              type={show ? "text" : "password"}
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="Password"
              autoFocus
              className="h-10 w-full rounded-md border bg-card px-3 pr-10 text-[14px] outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {error ? <p className="text-[12px] text-destructive">{error}</p> : null}
          <button
            type="submit"
            disabled={loading || !pwd}
            className="h-10 w-full rounded-md bg-foreground text-[13px] font-medium text-background transition-opacity disabled:opacity-50"
          >
            {loading ? "Checking…" : "View onboarding"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ---------- Main view ----------

function OnboardingView({ token }: { token: string }) {
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [query, setQuery] = React.useState("");

  const loadData = React.useCallback(() => {
    fetch("/api/onboarding-view/data", {
      headers: { "x-onboarding-token": token },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); return; }
        const { leads, deals, companies, onboardings } = data;
        const companyMap = new Map<string, Company>(companies.map((c: Company) => [c.id, c]));
        const dealMap = new Map<string, Deal>(deals.map((d: Deal) => [d.lead_id, d]));
        const obMap = new Map<string, Onboarding>(onboardings.map((o: Onboarding) => [o.lead_id, o]));

        // Only show leads whose deal is in a "won" stage
        const wonStages = new Set(["closed_won", "contract", "operationalized"]);
        const built: Row[] = (leads as Lead[])
          .map((lead) => ({
            lead,
            company: lead.company_id ? (companyMap.get(lead.company_id) ?? null) : null,
            deal: dealMap.get(lead.id) ?? null,
            onboarding: obMap.get(lead.id) ?? null,
          }))
          .filter((r) => r.deal && wonStages.has(r.deal.stage));

        setRows(built);
      })
      .catch(() => setError("Failed to load data."))
      .finally(() => setLoading(false));
  }, [token]);

  React.useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30_000);
    return () => clearInterval(interval);
  }, [loadData]);

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(({ lead, company }) =>
      [lead.name, lead.email, company?.name, company?.domain]
        .filter(Boolean).join(" ").toLowerCase().includes(q),
    );
  }, [rows, query]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-[13px] text-muted-foreground animate-pulse">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-[13px] text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <div className="border-b px-4 py-4 sm:px-6">
        <div className="flex items-baseline gap-2.5">
          <h1 className="text-[18px] font-semibold tracking-tight">Onboarding</h1>
          <span className="font-mono text-[12px] tabular-nums text-muted-foreground">{visible.length}</span>
        </div>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Operationalisation sheet for closed deals — read-only view.
        </p>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 border-b px-4 py-3 sm:px-6">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search brand, contact…"
            className="h-8 w-full rounded-md border bg-card pl-8 pr-3 text-[13px] outline-none focus:ring-1 focus:ring-ring"
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
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
              <table className="w-full text-[13px]">
                <thead className="bg-muted/30 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                  <tr>
                    <Th className="w-[30%]">Brand / Contact</Th>
                    <Th>Service</Th>
                    <Th>Ops checkpoints</Th>
                    <Th>Go live timeline</Th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {visible.map(({ lead, company, onboarding }) => {
                    const checkpoints = [
                      { label: "Operationalised",  done: !!onboarding?.operationalised },
                      { label: "First video live",  done: !!onboarding?.first_video_live_link },
                      { label: "Finance looped",    done: !!onboarding?.finance_team_looped_in },
                      { label: "Account manager",   done: !!onboarding?.account_manager_assigned },
                    ];
                    const doneCount = checkpoints.filter((c) => c.done).length;
                    return (
                      <tr key={lead.id} className="hover:bg-accent/40">
                        <Td>
                          <Link href={`/onboarding-view/${lead.id}`} className="flex items-center gap-3">
                            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md border bg-muted text-[11px] font-medium">
                              {initials(company?.name ?? lead.name)}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate font-medium tracking-tight">{company?.name ?? lead.name}</div>
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
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{doneCount}/4</span>
                            <div className="flex gap-0.5">
                              {checkpoints.map((c, i) => (
                                <span key={i} title={c.label}>
                                  {c.done
                                    ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                    : <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />}
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="divide-y rounded-lg border bg-card md:hidden">
              {visible.map(({ lead, company, onboarding }) => {
                const doneCount = [
                  !!onboarding?.operationalised, !!onboarding?.first_video_live_link,
                  !!onboarding?.finance_team_looped_in, !!onboarding?.account_manager_assigned,
                ].filter(Boolean).length;
                return (
                  <li key={lead.id}>
                    <Link href={`/onboarding-view/${lead.id}`} className="block px-3.5 py-3 active:bg-accent">
                      <div className="flex items-start gap-3">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md border bg-muted text-[11px] font-medium">
                          {initials(company?.name ?? lead.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[14px] font-medium tracking-tight">{company?.name ?? lead.name}</div>
                          <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>{lead.service_type ? SERVICE_TYPE_LABEL[lead.service_type] ?? lead.service_type : "—"}</span>
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

// ---------- Root (gate → view) ----------

export default function OnboardingViewPage() {
  const [token, setToken] = React.useState<string | null>(null);

  React.useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) setToken(stored);
  }, []);

  if (token === null) {
    return <PasswordGate onUnlock={setToken} />;
  }
  return <OnboardingView token={token} />;
}

// ---------- tiny helpers ----------

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}
function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 py-2 text-left font-medium", className)}>{children}</th>;
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-2.5 align-middle", className)}>{children}</td>;
}
