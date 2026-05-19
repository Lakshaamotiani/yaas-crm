"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft, Building2, Globe, Pencil, Plus, Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { StageChip } from "@/components/stage-chip";
import { ActivityTimeline } from "@/components/lead-detail/activity-timeline";
import { LinkList } from "@/components/companies/link-editor";
import {
  CompanyForm, companyToForm, formToCompanyPatch, type CompanyFormState,
} from "@/components/companies/company-form";
import { AdminOnly } from "@/lib/roles";
import {
  useCompanyAggregate, useActions, useOverview, narrativeActivities,
} from "@/lib/store";
import { cn, formatCurrency, formatDate, initials, relativeTime } from "@/lib/utils";

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const actions = useActions();
  const { company, contacts, activities, totals } = useCompanyAggregate(id);
  // Same policy as the lead detail page — surface only narrative events.
  const visibleActivities = React.useMemo(() => narrativeActivities(activities), [activities]);
  const overview = useOverview();
  const [editing, setEditing] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  if (!company) {
    return (
      <div className="grid min-h-screen place-items-center px-6">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Company not found.</p>
          <Button variant="ghost" size="sm" className="mt-4" asChild>
            <Link href="/companies"><ArrowLeft /> Back to companies</Link>
          </Button>
        </div>
      </div>
    );
  }

  const contactsWithDeals = contacts.map((c) => overview.find((o) => o.id === c.id) ?? null);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Slim back link — no entity name (the company aside already shows
          it). Click returns to the companies list. */}
      <div className="px-4 pt-3 sm:px-6 sm:pt-4">
        <Link
          href="/companies"
          className="inline-flex items-center gap-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Companies
        </Link>
      </div>

      {/* On mobile, company info aside stacks first (identity context),
          then the operational tabs (Contacts / Activity / Deals) sit at
          the bottom. The "Add contact" CTA lives inside the Contacts tab. */}
      <div className="grid flex-1 grid-cols-1 md:grid-cols-[320px_minmax(0,1fr)]">
        {/* Left sidebar — company info. Bottom border on mobile (it stacks
            first and the tabs follow), right border on desktop. */}
        <aside className="flex h-full flex-col border-b bg-card/30 md:border-b-0 md:border-r">
        <div className="border-b p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md border bg-muted text-[12px] font-semibold">
              {initials(company.name) || <Building2 className="h-5 w-5 text-muted-foreground" />}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold tracking-tight">{company.name}</div>
              <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {company.domain ?? company.industry ?? "—"}
              </div>
              {company.tags.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {company.tags.map((t) => (
                    <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-thin">
          <SectionTitle>Details</SectionTitle>
          <div className="space-y-2.5 text-xs">
            <KV label="Domain">
              {company.domain ? (
                <a
                  href={`https://${company.domain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 truncate text-foreground hover:underline"
                >
                  <Globe className="h-3 w-3" />
                  {company.domain}
                </a>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </KV>
            <KV label="Industry">
              <span className="truncate">{company.industry ?? <Muted />}</span>
            </KV>
            <KV label="Team size">
              <span>{company.size ?? <Muted />}</span>
            </KV>
            <KV label="Created">
              <span className="text-muted-foreground" suppressHydrationWarning>
                {formatDate(company.created_at, "medium")}
              </span>
            </KV>
          </div>

          <Separator className="my-4" />

          <SectionTitle>Links</SectionTitle>
          <LinkList links={company.links} />

          <Separator className="my-4" />

          <SectionTitle>Stats</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Contacts" value={totals.contacts} />
            <Stat label="Open deals" value={totals.openDeals} />
            <Stat label="Open MRR" value={formatCurrency(totals.totalMrr, { compact: true })} />
            <Stat label="Closed MRR" value={formatCurrency(totals.closedMrr, { compact: true })} />
          </div>

          <Separator className="my-4" />

          <SectionTitle>Notes</SectionTitle>
          {company.notes ? (
            <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-foreground/80">
              {company.notes}
            </p>
          ) : (
            <p className="text-[12px] italic text-muted-foreground">
              No notes yet. Click <span className="font-medium">Edit</span> at the top to add some.
            </p>
          )}
        </div>

        <div className="border-t p-3">
          <AdminOnly
            fallback={
              <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="w-full">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            }
          >
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            </div>
          </AdminOnly>
        </div>
      </aside>

      {/* Main column — natural source order on mobile (aside above, main below). */}
      <div className="flex min-w-0 flex-col">
        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin sm:p-6">
          <Tabs defaultValue="contacts" className="space-y-4">
            {/* Tab strip on the left, primary "Add contact" CTA on the right.
                "Add contact" used to live in the now-removed page-level
                breadcrumb — putting it next to the tabs keeps it close to
                where contacts are actually managed. */}
            <div className="flex items-center justify-between gap-3">
              <TabsList>
                <TabsTrigger value="contacts">
                  Contacts <span className="ml-1.5 font-mono text-[10px] tabular-nums text-muted-foreground">{totals.contacts}</span>
                </TabsTrigger>
                <TabsTrigger value="activity">
                  Activity <span className="ml-1.5 font-mono text-[10px] tabular-nums text-muted-foreground">{visibleActivities.length}</span>
                </TabsTrigger>
                <TabsTrigger value="deals">
                  Deals <span className="ml-1.5 font-mono text-[10px] tabular-nums text-muted-foreground">{totals.openDeals}</span>
                </TabsTrigger>
              </TabsList>
              <Button size="sm" asChild>
                <Link href={`/leads/new?company=${company.id}`}>
                  <Plus className="h-3.5 w-3.5" /> Add contact
                </Link>
              </Button>
            </div>

            <TabsContent value="contacts" className="m-0">
              <ContactsList
                rows={contactsWithDeals.filter((x): x is NonNullable<typeof x> => !!x)}
              />
            </TabsContent>

            <TabsContent value="activity" className="m-0">
              {visibleActivities.length === 0 ? (
                <div className="rounded-lg border border-dashed py-12 text-center text-[13px] text-muted-foreground">
                  No activity across this company yet.
                </div>
              ) : (
                <ActivityTimeline activities={visibleActivities} />
              )}
            </TabsContent>

            <TabsContent value="deals" className="m-0">
              <DealsList rows={contactsWithDeals.filter((x): x is NonNullable<typeof x> => !!x)} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
      </div>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit {company.name}</DialogTitle>
          </DialogHeader>
          <EditCompanyDialogBody
            initial={companyToForm(company)}
            onCancel={() => setEditing(false)}
            onSave={(state) => {
              actions.updateCompany(company.id, formToCompanyPatch(state));
              setEditing(false);
              toast.success("Company updated");
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {company.name}?</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-muted-foreground">
            Deletes the company. Existing contacts are <strong>not</strong> deleted — they'll just lose their company link. You can reassign them after.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                actions.deleteCompany(company.id);
                toast.success("Company deleted");
                router.push("/companies");
              }}
            >
              Delete company
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------- subviews ----------

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </h3>
  );
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <div className="min-w-0 text-right">{children}</div>
    </div>
  );
}

function Muted() {
  return <span className="text-muted-foreground">—</span>;
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-card p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-[14px] font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function ContactsList({ rows }: { rows: import("@/lib/types").LeadOverview[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center text-[13px] text-muted-foreground">
        No contacts yet at this company. Click <strong>Add contact</strong> to attach one.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <ul className="divide-y">
        {rows.map((l) => (
          <li key={l.id} className="group">
            <Link
              href={`/leads/${l.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-muted text-[10px]">{initials(l.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-medium tracking-tight">{l.name}</span>
                  {l.deal_stage ? <StageChip stage={l.deal_stage} /> : null}
                </div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {[l.role, l.email].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
              <div className="hidden flex-col items-end text-right md:flex">
                {l.value_mrr ? (
                  <span className="font-mono text-[12px] tabular-nums">
                    {formatCurrency(l.value_mrr, { compact: true })}/mo
                  </span>
                ) : null}
                <span className="text-[10px] text-muted-foreground" suppressHydrationWarning>
                  {relativeTime(l.updated_at)}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DealsList({ rows }: { rows: import("@/lib/types").LeadOverview[] }) {
  const withDeals = rows.filter((r) => r.deal_id);
  if (withDeals.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center text-[13px] text-muted-foreground">
        No deals yet for this company.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <ul className="divide-y">
        {withDeals.map((l) => (
          <li key={l.id}>
            <Link
              href={`/leads/${l.id}`}
              className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-4 py-3 hover:bg-accent/40"
            >
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium">{l.name}</div>
                <div className="truncate text-[11px] text-muted-foreground">{l.role ?? "—"}</div>
              </div>
              {l.deal_stage ? <StageChip stage={l.deal_stage} /> : <span />}
              <span className={cn(
                "font-mono text-[12px] tabular-nums",
                !l.value_mrr && "text-muted-foreground",
              )}>
                {l.value_mrr ? `${formatCurrency(l.value_mrr, { compact: true })}/mo` : "—"}
              </span>
              <span className="text-[11px] text-muted-foreground" suppressHydrationWarning>
                {relativeTime(l.updated_at)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EditCompanyDialogBody({
  initial, onCancel, onSave,
}: {
  initial: CompanyFormState;
  onCancel: () => void;
  onSave: (state: CompanyFormState) => void;
}) {
  const [form, setForm] = React.useState(initial);
  const canSave = form.name.trim().length > 0;
  return (
    <div className="space-y-5">
      <div className="max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin">
        <CompanyForm value={form} onChange={setForm} />
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(form)} disabled={!canSave}>Save</Button>
      </DialogFooter>
    </div>
  );
}
