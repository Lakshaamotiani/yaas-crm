"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Building2, Plus, CalendarClock, Check } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  useLead, useOnboarding, useActions, useStageLabels, useStoreActivities,
} from "@/lib/store";
import { cn, formatDate, initials } from "@/lib/utils";
import { SERVICE_TYPE_LABEL } from "@/lib/constants";
import type { Activity, Onboarding } from "@/lib/types";

export default function OnboardingDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const leadId = params?.id ?? "";

  const { lead, deal, company } = useLead(leadId);
  const onboarding = useOnboarding(leadId);
  const stageLabels = useStageLabels();
  const actions = useActions();

  if (!lead) {
    return (
      <div className="flex min-h-screen flex-col">
        <PageHeader title="Onboarding" />
        <div className="grid flex-1 place-items-center p-8 text-center">
          <p className="text-[13px] text-muted-foreground">Lead not found.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => router.push("/onboarding")}>
            Back to onboarding
          </Button>
        </div>
      </div>
    );
  }

  // Local form state — patches go to the store on blur/change so reloads
  // pick up the latest values. The store upserts the row on first write.
  const o: Partial<Onboarding> = onboarding ?? {};
  const update = (patch: Partial<Onboarding>) => {
    actions.updateOnboarding(leadId, patch);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2.5">
            <Link
              href="/onboarding"
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Back to onboarding list"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span>{company?.name ?? lead.name}</span>
            {deal?.stage ? (
              <Badge variant="outline" className="text-[10px]">
                {stageLabels[deal.stage] ?? deal.stage}
              </Badge>
            ) : null}
          </span>
        }
        subtitle={
          <span className="inline-flex items-center gap-2">
            <span>{lead.name}</span>
            {lead.service_type ? (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span>{SERVICE_TYPE_LABEL[lead.service_type] ?? lead.service_type}</span>
              </>
            ) : null}
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={`/onboarding-view/${lead.id}`} target="_blank" rel="noopener noreferrer">
                Client view <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/leads/${lead.id}`}>
                Open lead <ExternalLink className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid flex-1 grid-cols-1 gap-5 p-4 sm:p-6 lg:grid-cols-[1fr_360px]">
        {/* Left column — scope, ops, contact, workflow */}
        <div className="space-y-5">
          <Section title="Final scope of work">
            <FieldRow>
              <Field label="Final scope of work" wide>
                <Textarea
                  rows={4}
                  defaultValue={o.final_scope_of_work ?? ""}
                  placeholder="Final agreed scope — deliverables, exclusions, dependencies…"
                  onBlur={(e) => commit(o.final_scope_of_work, e.target.value, (v) => update({ final_scope_of_work: v }))}
                />
              </Field>
            </FieldRow>
            <FieldRow cols={2}>
              <Field label="Number of videos">
                <Input
                  type="number"
                  min={0}
                  defaultValue={o.number_of_videos ?? ""}
                  onBlur={(e) => {
                    const v = e.target.value === "" ? null : Number(e.target.value);
                    commit(o.number_of_videos, v, (val) => update({ number_of_videos: val }));
                  }}
                />
              </Field>
              <Field label="Format">
                <Input
                  defaultValue={o.format ?? ""}
                  placeholder="e.g. 4×8min docu-style + 8×60s shorts"
                  onBlur={(e) => commit(o.format, e.target.value || null, (v) => update({ format: v }))}
                />
              </Field>
            </FieldRow>
            <FieldRow cols={2}>
              <Field label="Go-live timeline">
                <Input
                  defaultValue={o.go_live_timeline ?? ""}
                  placeholder="e.g. First episode by 15 Jun"
                  onBlur={(e) => commit(o.go_live_timeline, e.target.value || null, (v) => update({ go_live_timeline: v }))}
                />
              </Field>
              <Field label="Platform">
                <Input
                  defaultValue={o.platform ?? ""}
                  placeholder="YouTube, Instagram, LinkedIn…"
                  onBlur={(e) => commit(o.platform, e.target.value || null, (v) => update({ platform: v }))}
                />
              </Field>
            </FieldRow>
            <FieldRow>
              <Field label="Team required" wide>
                <Textarea
                  rows={2}
                  defaultValue={o.team_required ?? ""}
                  placeholder="e.g. 1 producer, 2 editors, 1 motion designer, scriptwriter on retainer"
                  onBlur={(e) => commit(o.team_required, e.target.value || null, (v) => update({ team_required: v }))}
                />
              </Field>
            </FieldRow>
          </Section>

          <Section title="Ops checkpoints">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <CheckboxRow
                checked={!!o.operationalised}
                onChange={(v) => update({ operationalised: v })}
                label="Operationalised"
                hint="Team briefed, kickoff done"
              />
              <CheckboxRow
                checked={!!o.finance_team_looped_in}
                onChange={(v) => update({ finance_team_looped_in: v })}
                label="Finance team looped in"
                hint="Invoice + PO trail set up"
              />
              <CheckboxRow
                checked={!!o.account_manager_assigned}
                onChange={(v) => update({ account_manager_assigned: v })}
                label="Account manager assigned"
                hint="Single point of contact named"
              />
              <CheckboxRow
                checked={!!o.first_video_live_link}
                onChange={() => { /* derived from URL field */ }}
                label="First video live"
                hint="Auto-set when URL is filled below"
                readOnly
              />
            </div>
            <FieldRow>
              <Field label="First video live link" wide>
                <Input
                  type="url"
                  defaultValue={o.first_video_live_link ?? ""}
                  placeholder="https://…"
                  onBlur={(e) => commit(o.first_video_live_link, e.target.value || null, (v) => update({ first_video_live_link: v }))}
                />
              </Field>
            </FieldRow>
          </Section>

          <Section title="Contact">
            <FieldRow cols={2}>
              <Field label="POC name">
                <Input
                  defaultValue={o.poc_name ?? lead.name ?? ""}
                  onBlur={(e) => commit(o.poc_name, e.target.value || null, (v) => update({ poc_name: v }))}
                />
              </Field>
              <Field label="Lead source">
                <Input
                  defaultValue={o.lead_source ?? lead.source ?? ""}
                  readOnly
                  className="bg-muted/30"
                />
              </Field>
            </FieldRow>
            <FieldRow cols={2}>
              <Field label="WhatsApp number">
                <Input
                  type="tel"
                  defaultValue={o.whatsapp_number ?? lead.phone ?? ""}
                  placeholder="+91 …"
                  onBlur={(e) => {
                    const v = e.target.value || null;
                    commit(o.whatsapp_number, v, (val) => update({ whatsapp_number: val }));
                    // Mirror to lead.phone — single source of truth.
                    if (v !== lead.phone) actions.updateLead(lead.id, { phone: v });
                  }}
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  defaultValue={o.email ?? lead.email ?? ""}
                  onBlur={(e) => {
                    const v = e.target.value || null;
                    commit(o.email, v, (val) => update({ email: val }));
                    if (v !== lead.email) actions.updateLead(lead.id, { email: v });
                  }}
                />
              </Field>
            </FieldRow>
          </Section>

          <Section title="Workflow">
            <FieldRow cols={2}>
              <Field label="Next action">
                <Input
                  defaultValue={o.next_action ?? ""}
                  placeholder="e.g. Share INT brief with team"
                  onBlur={(e) => commit(o.next_action, e.target.value || null, (v) => update({ next_action: v }))}
                />
              </Field>
              <Field label="Next action date">
                <DatePicker
                  value={o.next_action_date ? new Date(o.next_action_date) : undefined}
                  onChange={(d) =>
                    update({ next_action_date: d ? d.toISOString().slice(0, 10) : null })
                  }
                />
              </Field>
            </FieldRow>
            <FieldRow>
              <Field label="Daily notes" wide>
                <Textarea
                  rows={5}
                  defaultValue={o.daily_notes ?? ""}
                  placeholder="Running log — blockers, decisions, sentiment…"
                  onBlur={(e) => commit(o.daily_notes, e.target.value || null, (v) => update({ daily_notes: v }))}
                />
              </Field>
            </FieldRow>
          </Section>
        </div>

        {/* Right column — document trail + tasks */}
        <div className="space-y-5">
          <TasksSection leadId={lead.id} />

          <Section title="Document trail" tight>
            <DocLink label="Briefing doc"        url={o.briefing_doc_url}      onSave={(v) => update({ briefing_doc_url: v })} />
            <DocLink label="Pitch deck"          url={o.pitch_deck_url}        onSave={(v) => update({ pitch_deck_url: v })} />
            <DocLink label="Proposal doc"        url={o.proposal_doc_url}      onSave={(v) => update({ proposal_doc_url: v })} />
            <DocLink label="Final MSA"           url={o.final_msa_url}         onSave={(v) => update({ final_msa_url: v })} />
            <DocLink label="Signed SOW"          url={o.signed_sow_url}        onSave={(v) => update({ signed_sow_url: v })} />
            <DocLink label="PO / 1st invoice"    url={o.po_first_invoice_url}  onSave={(v) => update({ po_first_invoice_url: v })} />
            <DocLink
              label="Final INT brief"
              hint="Single source of truth"
              url={o.final_int_brief_url}
              onSave={(v) => update({ final_int_brief_url: v })}
            />
          </Section>

          <Section title="Context" tight>
            <div className="space-y-2 text-[12px]">
              <KV label="Company">
                <span className="inline-flex items-center gap-1.5">
                  {company ? (
                    <>
                      <Building2 className="h-3 w-3 text-muted-foreground" />
                      <Link href={`/companies/${company.id}`} className="hover:underline">
                        {company.name}
                      </Link>
                    </>
                  ) : "—"}
                </span>
              </KV>
              <KV label="Deal value">
                <span className="font-mono tabular-nums">
                  {deal ? (
                    <>
                      ₹{deal.value_mrr ?? 0}/mo
                      {deal.value_one_time ? ` + ₹${deal.value_one_time} one-time` : ""}
                    </>
                  ) : "—"}
                </span>
              </KV>
              <KV label="Service">
                {lead.service_type
                  ? SERVICE_TYPE_LABEL[lead.service_type] ?? lead.service_type
                  : "—"}
              </KV>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

// ---------- Tasks section ----------

function TasksSection({ leadId }: { leadId: string }) {
  const allActivities = useStoreActivities();
  const actions = useActions();

  const tasks = React.useMemo(
    () =>
      allActivities
        .filter((a) => a.lead_id === leadId && a.type === "task")
        .sort((a, b) => {
          // pending first, then by due date, then created_at
          if (a.status !== b.status) return a.status === "pending" ? -1 : 1;
          const da = a.due_at ? +new Date(a.due_at) : Infinity;
          const db = b.due_at ? +new Date(b.due_at) : Infinity;
          return da - db;
        }),
    [allActivities, leadId],
  );

  return (
    <section className="rounded-xl border bg-card">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Tasks
        </h2>
        <AddTaskPopover leadId={leadId} />
      </header>
      <div className="p-4">
        {tasks.length === 0 ? (
          <p className="text-center text-[12px] text-muted-foreground py-3">No tasks yet</p>
        ) : (
          <ul className="space-y-2">
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onComplete={() => actions.completeActivity(task.id)}
                onUncomplete={() => actions.uncompleteActivity(task.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function TaskRow({
  task,
  onComplete,
  onUncomplete,
}: {
  task: Activity;
  onComplete: () => void;
  onUncomplete: () => void;
}) {
  const done = task.status === "completed";
  const overdue =
    !done && task.due_at && +new Date(task.due_at) < Date.now();

  return (
    <li className="flex items-start gap-2.5">
      <button
        type="button"
        onClick={done ? onUncomplete : onComplete}
        className={cn(
          "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border transition-colors",
          done
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-muted-foreground/40 hover:border-foreground/50",
        )}
        aria-label={done ? "Mark incomplete" : "Mark complete"}
      >
        {done ? <Check className="h-2.5 w-2.5" /> : null}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn("text-[13px] leading-snug", done && "text-muted-foreground line-through")}>
          {task.title ?? "Untitled task"}
        </p>
        {task.due_at ? (
          <p className={cn("mt-0.5 text-[11px]", overdue ? "text-destructive" : "text-muted-foreground")}>
            Due {formatDate(new Date(task.due_at), "short")}
          </p>
        ) : null}
      </div>
    </li>
  );
}

function AddTaskPopover({ leadId }: { leadId: string }) {
  const actions = useActions();
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [due, setDue] = React.useState<Date | undefined>(undefined);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setTitle("");
      setDue(undefined);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  function save() {
    const cleaned = title.trim();
    if (!cleaned) {
      toast.error("Add a task title");
      inputRef.current?.focus();
      return;
    }
    actions.logActivity({
      lead_id: leadId,
      type: "task",
      title: cleaned,
      status: "pending",
      due_at: due ? due.toISOString() : null,
    });
    toast.success("Task added");
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-[12px]">
          <Plus className="h-3.5 w-3.5" /> Add task
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[280px] space-y-3 p-3">
        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground">Task</Label>
          <Input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } }}
            placeholder="e.g. Share INT brief with team"
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground">Due date (optional)</Label>
          <DatePicker
            value={due}
            onChange={(d) => setDue(d ?? undefined)}
            size="sm"
            align="start"
            placeholder="Pick a date"
            clearable
            className="w-full"
          />
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          <Button size="sm" onClick={save}>
            <CalendarClock className="h-3.5 w-3.5" /> Add task
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------- helpers ----------

function commit<T>(prev: T | null | undefined, next: T | null, save: (v: T | null) => void) {
  if ((prev ?? null) === (next ?? null)) return;
  save(next);
  toast.success("Saved");
}

function Section({
  title, children, tight,
}: {
  title: string;
  children: React.ReactNode;
  tight?: boolean;
}) {
  return (
    <section className="rounded-xl border bg-card">
      <header className="border-b px-4 py-3">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {title}
        </h2>
      </header>
      <div className={cn("p-4", tight ? "space-y-2.5" : "space-y-3.5")}>
        {children}
      </div>
    </section>
  );
}

function FieldRow({ children, cols }: { children: React.ReactNode; cols?: number }) {
  return (
    <div className={cn(
      "grid gap-3",
      cols === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1",
    )}>
      {children}
    </div>
  );
}

function Field({ label, children, wide: _wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function CheckboxRow({
  checked, onChange, label, hint, readOnly,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  readOnly?: boolean;
}) {
  return (
    <label className={cn(
      "flex items-start gap-2.5 rounded-md border bg-background p-2.5",
      readOnly && "opacity-70",
    )}>
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => !readOnly && onChange(v === true)}
        disabled={readOnly}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-medium">{label}</div>
        {hint ? <div className="text-[10px] text-muted-foreground">{hint}</div> : null}
      </div>
    </label>
  );
}

function DocLink({
  label, hint, url, onSave,
}: {
  label: string;
  hint?: string;
  url?: string | null;
  onSave: (v: string | null) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-[11px] text-muted-foreground">{label}</Label>
        {url ? (
          <a href={url} target="_blank" rel="noreferrer"
             className="text-[10px] text-muted-foreground hover:text-foreground">
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </div>
      <Input
        type="url"
        defaultValue={url ?? ""}
        placeholder={hint ?? "https://…"}
        onBlur={(e) => {
          const v = e.target.value || null;
          if ((url ?? null) !== v) { onSave(v); toast.success("Saved"); }
        }}
        className="h-8 text-xs"
      />
      {hint && url ? <p className="text-[10px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}
