"use client";

import * as React from "react";
import { toast } from "sonner";
import Link from "next/link";
import {
  Mail, Phone, Globe, User2, Building2, Tag, Pencil, Check, X, ExternalLink,
  ArrowRight, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StageChip } from "@/components/stage-chip";
import type { Lead, Deal, Qualification, Company } from "@/lib/types";
import {
  useActions, useProfiles, useTemplates, useCompany, useCompanyAggregate,
  usePipelineStages,
} from "@/lib/store";
import { LinkList } from "@/components/companies/link-editor";
import { DatePicker } from "@/components/ui/date-picker";
import { MoneyInput } from "@/components/money-input";
import { SERVICE_TYPES } from "@/lib/constants";
import { cn, formatMoney, formatDate, initials } from "@/lib/utils";

export function LeadSidebar({
  lead,
  deal,
  qualification,
  className,
}: {
  lead: Lead;
  deal: Deal | null;
  qualification: Qualification | null;
  className?: string;
}) {
  const profiles = useProfiles();
  const actions = useActions();
  const { sourceLabels } = useTemplates();
  const company = useCompany(lead.company_id);
  const owner = profiles.find((p) => p.id === lead.owner_id) ?? null;

  return (
    <aside className={cn(
      // On mobile the aside stacks ABOVE script/notes/activity (the action
      // bar sits in its own mobile-only row above this), so it reads as a
      // section divided by a bottom border. On desktop it's the left rail
      // with a right border separating it from the main column.
      "flex h-full flex-col border-b bg-card/30 md:border-b-0 md:border-r",
      className,
    )}>
      <div className="border-b p-5">
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-foreground text-xs font-semibold text-background">
              {initials(lead.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <EditableText
              value={lead.name}
              onSave={(v) => actions.updateLead(lead.id, { name: v })}
              className="text-base font-semibold tracking-tight"
            />
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              {deal?.stage ? <StageChip stage={deal.stage} /> : null}
              {company ? (
                <Link
                  href={`/companies/${company.id}`}
                  className="truncate hover:text-foreground hover:underline"
                >
                  · {company.name}
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-thin">
        <SectionTitle>Contact</SectionTitle>
        <div className="space-y-2.5">
          <Row icon={<Mail />} label="Email">
            <EditableText
              value={lead.email ?? ""}
              placeholder="Add email"
              onSave={(v) => actions.updateLead(lead.id, { email: v || null })}
            />
          </Row>
          <Row icon={<Phone />} label="Phone">
            <EditableText
              value={lead.phone ?? ""}
              placeholder="Add phone"
              onSave={(v) => actions.updateLead(lead.id, { phone: v || null })}
            />
          </Row>
          <Row icon={<User2 />} label="Role">
            <EditableText
              value={lead.role ?? ""}
              placeholder="Founder, Head of Marketing…"
              onSave={(v) => actions.updateLead(lead.id, { role: v || null })}
            />
          </Row>
        </div>

        <Separator className="my-4" />
        <SectionTitle>Company</SectionTitle>
        <CompanyPanel lead={lead} company={company} />

        <Separator className="my-4" />
        <SectionTitle>Qualification</SectionTitle>
        {qualification ? (
          <QualForm leadId={lead.id} qualification={qualification} />
        ) : (
          <p className="text-xs text-muted-foreground">No qualification data yet.</p>
        )}

        <Separator className="my-4" />
        <SectionTitle>Deal</SectionTitle>
        {deal ? <DealForm deal={deal} /> : null}

        <Separator className="my-4" />
        <SectionTitle>Meta</SectionTitle>
        <div className="space-y-2.5 text-xs">
          <KV label="Owner">
            <div className="flex items-center gap-1.5">
              <Avatar className="h-5 w-5"><AvatarFallback className="text-[9px]">{initials(owner?.full_name ?? "?")}</AvatarFallback></Avatar>
              <span>{owner?.full_name ?? "Unassigned"}</span>
            </div>
          </KV>
          <KV label="Service type">
            <Select
              value={lead.service_type ?? ""}
              onValueChange={(v) => actions.updateLead(lead.id, { service_type: (v || null) as any })}
            >
              <SelectTrigger className="h-7 w-[170px] text-xs">
                <SelectValue placeholder="Select service" />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_TYPES.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </KV>
          <KV label="Source"><span>{sourceLabels[lead.source] ?? lead.source}</span></KV>
          <KV label="Tags">
            <TagsEditor
              value={lead.tags}
              onChange={(tags) => actions.updateLead(lead.id, { tags })}
            />
          </KV>
          <KV label="Created">
            <span className="text-muted-foreground" suppressHydrationWarning>
              {formatDate(lead.created_at, "medium")}
            </span>
          </KV>
        </div>
      </div>
    </aside>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </h3>
  );
}

function Row({
  icon, label, children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[16px_56px_1fr] items-center gap-2 text-xs">
      <span className="text-muted-foreground [&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>
      <span className="text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <div className="text-right">{children}</div>
    </div>
  );
}

function EditableText({
  value, onSave, placeholder, className,
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  React.useEffect(() => setDraft(value), [value]);

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          autoFocus
          className="h-7 text-xs"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
        />
        <Button size="icon-sm" variant="ghost" onClick={commit}><Check className="h-3.5 w-3.5" /></Button>
        <Button size="icon-sm" variant="ghost" onClick={() => setEditing(false)}><X className="h-3.5 w-3.5" /></Button>
      </div>
    );
    function commit() {
      onSave(draft.trim());
      setEditing(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`group flex w-full items-center justify-between gap-2 text-left ${className ?? "text-xs"}`}
    >
      <span className={value ? "truncate" : "truncate text-muted-foreground"}>
        {value || placeholder || "—"}
      </span>
      <Pencil className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

function ExternalEditable({
  value, onSave, placeholder, hrefBuilder,
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  hrefBuilder?: (v: string) => string;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  React.useEffect(() => setDraft(value), [value]);

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          autoFocus
          className="h-7 text-xs"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { onSave(draft.trim()); setEditing(false); }
            if (e.key === "Escape") setEditing(false);
          }}
        />
        <Button size="icon-sm" variant="ghost" onClick={() => { onSave(draft.trim()); setEditing(false); }}>
          <Check className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-1">
      {value ? (
        <a
          href={hrefBuilder ? hrefBuilder(value) : value}
          target="_blank"
          rel="noreferrer"
          className="truncate text-xs text-foreground hover:underline"
        >
          {value}
        </a>
      ) : (
        <span className="truncate text-xs text-muted-foreground">{placeholder ?? "—"}</span>
      )}
      <Button
        size="icon-sm"
        variant="ghost"
        className="opacity-0 transition-opacity group-hover:opacity-100"
        onClick={() => setEditing(true)}
      >
        <Pencil className="h-3 w-3" />
      </Button>
      {value ? (
        <a
          href={hrefBuilder ? hrefBuilder(value) : value}
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      ) : null}
    </div>
  );
}

function QualForm({ leadId, qualification }: { leadId: string; qualification: Qualification }) {
  const actions = useActions();
  const fit = qualification.fit_score ?? 0;
  const fitTone = fit >= 80 ? "text-stage-won" : fit >= 60 ? "text-stage-proposal" : "text-muted-foreground";

  const budgetAmount = qualification.budget_amount ?? null;
  const budgetCurrency = qualification.budget_currency ?? "USD";
  const budgetRecurrence = qualification.budget_recurrence ?? "monthly";

  return (
    <div className="space-y-2.5 text-xs">
      <KV label="Fit score">
        <span className={`font-mono text-sm font-semibold ${fitTone}`}>{fit}</span>
      </KV>
      {/* Budget — structured amount + currency + recurrence. Wider than the
          other rows so the segmented control fits. */}
      <div className="space-y-1.5">
        <Label className="block text-[10px] text-muted-foreground">Budget</Label>
        <MoneyInput
          amount={budgetAmount}
          currency={budgetCurrency}
          onAmountChange={(v) => actions.updateQualification(leadId, { budget_amount: v })}
          onCurrencyChange={(v) => actions.updateQualification(leadId, { budget_currency: v })}
          placeholder="Amount"
        />
        <div className="flex rounded-md border border-input p-0.5 text-[11px]">
          {(["monthly", "one_time"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => actions.updateQualification(leadId, { budget_recurrence: r })}
              className={cn(
                "flex-1 rounded px-2 py-1 transition-colors",
                budgetRecurrence === r
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r === "monthly" ? "Monthly" : "One-time"}
            </button>
          ))}
        </div>
      </div>
      <KV label="Decision maker">
        <Select
          value={qualification.decision_maker == null ? "unknown" : qualification.decision_maker ? "yes" : "no"}
          onValueChange={(v) =>
            actions.updateQualification(leadId, {
              decision_maker: v === "unknown" ? null : v === "yes",
            })
          }
        >
          <SelectTrigger className="h-7 w-[90px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="yes">Yes</SelectItem>
            <SelectItem value="no">No</SelectItem>
            <SelectItem value="unknown">Unknown</SelectItem>
          </SelectContent>
        </Select>
      </KV>
      <div className="pt-1">
        <Label className="mb-1 block text-[10px] text-muted-foreground">Notes</Label>
        <Textarea
          rows={3}
          className="text-xs"
          defaultValue={qualification.notes ?? ""}
          placeholder="Pain, goals, context…"
          onBlur={(e) => {
            if (e.target.value !== (qualification.notes ?? "")) {
              actions.updateQualification(leadId, { notes: e.target.value });
              toast.success("Notes saved");
            }
          }}
        />
      </div>
    </div>
  );
}

function NumberEditable({ value, onSave }: { value: number | null; onSave: (v: number | null) => void }) {
  const [draft, setDraft] = React.useState(value?.toString() ?? "");
  React.useEffect(() => setDraft(value?.toString() ?? ""), [value]);
  return (
    <Input
      className="h-7 w-20 text-right font-mono text-xs"
      value={draft}
      onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
      onBlur={() => {
        const n = draft === "" ? null : parseInt(draft, 10);
        if (n !== value) onSave(Number.isFinite(n as number) ? (n as number) : null);
      }}
    />
  );
}

function DealForm({ deal }: { deal: Deal }) {
  const actions = useActions();
  const stages = usePipelineStages();
  return (
    <div className="space-y-2.5 text-xs">
      <KV label="Stage">
        <Select value={deal.stage} onValueChange={(v: any) => actions.moveDeal(deal.id, v, 0)}>
          <SelectTrigger className="h-7 w-[140px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {stages.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </KV>
      <KV label="MRR">
        <MoneyInput
          className="h-7 w-[160px]"
          amount={deal.value_mrr ?? null}
          currency={deal.value_currency ?? "USD"}
          onAmountChange={(v) => actions.updateDeal(deal.id, { value_mrr: v ?? 0 })}
          onCurrencyChange={(v) => actions.updateDeal(deal.id, { value_currency: v })}
        />
      </KV>
      <KV label="One-time">
        <MoneyInput
          className="h-7 w-[160px]"
          amount={deal.value_one_time ?? null}
          currency={deal.value_currency ?? "USD"}
          onAmountChange={(v) => actions.updateDeal(deal.id, { value_one_time: v ?? 0 })}
          onCurrencyChange={(v) => actions.updateDeal(deal.id, { value_currency: v })}
        />
      </KV>
      <KV label="Probability">
        <NumberEditable
          value={deal.probability}
          onSave={(v) => actions.updateDeal(deal.id, { probability: v ?? 0 })}
        />
      </KV>
      <KV label="Expected close">
        <DatePicker
          size="sm"
          align="end"
          placeholder="No date"
          value={deal.expected_close_date ? new Date(deal.expected_close_date) : undefined}
          onChange={(d) =>
            actions.updateDeal(deal.id, {
              expected_close_date: d ? d.toISOString().slice(0, 10) : null,
            })
          }
          className="h-7 w-[150px] px-2 text-xs"
        />
      </KV>
    </div>
  );
}

function TagsEditor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const { tagVocabulary } = useTemplates();
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const suggestions = tagVocabulary.filter((t) => !value.includes(t));

  function add(tag: string) {
    const v = tag.trim().toLowerCase();
    if (!v || value.includes(v)) return;
    onChange([...value, v]);
    setDraft("");
  }
  function remove(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1">
        {value.length === 0 && <span className="text-muted-foreground">—</span>}
        {value.map((t) => (
          <Badge key={t} variant="outline" className="gap-1 pr-1 text-[10px]">
            <Tag className="h-2.5 w-2.5" />
            {t}
            <button
              onClick={() => remove(t)}
              className="ml-0.5 rounded-sm p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label={`Remove ${t}`}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </Badge>
        ))}
        <button
          onClick={() => setOpen((o) => !o)}
          className="rounded-md border border-dashed px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
        >
          + Add
        </button>
      </div>
      {open ? (
        <div className="space-y-1.5 rounded-md border bg-background p-2">
          <div className="flex gap-1">
            <Input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(draft); } }}
              placeholder="New tag…"
              className="h-7 text-xs"
            />
            <Button size="icon-sm" variant="ghost" onClick={() => add(draft)}>
              <Check className="h-3.5 w-3.5" />
            </Button>
          </div>
          {suggestions.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {suggestions.map((t) => (
                <button
                  key={t}
                  onClick={() => add(t)}
                  className="rounded-md border bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                >
                  {t}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ============================================================================
// CompanyPanel — shows the linked company (with cross-link), its key links,
// and sibling contacts at the same company.
// ============================================================================

function CompanyPanel({ lead, company }: { lead: Lead; company: Company | null }) {
  const aggregate = useCompanyAggregate(company?.id);
  const otherContacts = aggregate.contacts.filter((c) => c.id !== lead.id);

  if (!company) {
    return (
      <div className="rounded-md border border-dashed bg-card px-3 py-2.5 text-[12px] text-muted-foreground">
        Not linked to a company yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Link
        href={`/companies/${company.id}`}
        className="group flex items-center gap-2.5 rounded-md border bg-card px-2.5 py-2 transition-colors hover:border-foreground/20"
      >
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md border bg-muted text-[10px] font-medium">
          {initials(company.name) || <Building2 className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium tracking-tight">{company.name}</div>
          <div className="truncate text-[10px] text-muted-foreground">
            {company.domain ?? company.industry ?? "—"}
          </div>
        </div>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </Link>

      {company.links.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80">Links</p>
          <LinkList links={company.links} />
        </div>
      ) : null}

      {otherContacts.length > 0 ? (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/80">
            <Users className="h-3 w-3" />
            Other contacts ({otherContacts.length})
          </p>
          <ul className="space-y-1">
            {otherContacts.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/leads/${c.id}`}
                  className="flex items-center gap-2 rounded-md px-1.5 py-1 text-[12px] text-foreground/90 transition-colors hover:bg-accent/60"
                >
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-[9px]">{initials(c.name)}</AvatarFallback>
                  </Avatar>
                  <span className="truncate">{c.name}</span>
                  {c.role ? (
                    <span className="truncate text-[10px] text-muted-foreground">· {c.role}</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
