"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Tag, X } from "lucide-react";
import { useTemplates } from "@/lib/store";
import type { Company, CompanySize } from "@/lib/types";
import { extractDomain } from "@/lib/utils";
import { LinkEditor } from "./link-editor";

const SIZES: { id: CompanySize; label: string }[] = [
  { id: "1-10",     label: "1–10" },
  { id: "11-50",    label: "11–50" },
  { id: "51-200",   label: "51–200" },
  { id: "201-500",  label: "201–500" },
  { id: "501-1000", label: "501–1,000" },
  { id: "1000+",    label: "1,000+" },
];

export interface CompanyFormState {
  name: string;
  domain: string;
  industry: string;
  size: CompanySize | "";
  notes: string;
  tags: string[];
  links: Company["links"];
}

export function emptyCompanyForm(): CompanyFormState {
  return { name: "", domain: "", industry: "", size: "", notes: "", tags: [], links: [] };
}

export function companyToForm(c: Company): CompanyFormState {
  return {
    name: c.name,
    domain: c.domain ?? "",
    industry: c.industry ?? "",
    size: c.size ?? "",
    notes: c.notes ?? "",
    tags: c.tags,
    links: c.links,
  };
}

export function formToCompanyPatch(state: CompanyFormState): Partial<Company> & { name: string } {
  return {
    name: state.name.trim(),
    domain: state.domain.trim() || extractDomain(state.domain) || null,
    industry: state.industry.trim() || null,
    size: (state.size || null) as CompanySize | null,
    notes: state.notes.trim() || null,
    tags: state.tags,
    links: state.links,
  };
}

export function CompanyForm({
  value, onChange,
}: {
  value: CompanyFormState;
  onChange: (s: CompanyFormState) => void;
}) {
  function patch(p: Partial<CompanyFormState>) {
    onChange({ ...value, ...p });
  }

  return (
    <div className="space-y-6">
      <Section title="Company">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required>
            <Input
              value={value.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="Hammond & Co"
            />
          </Field>
          <Field label="Domain">
            <Input
              value={value.domain}
              onChange={(e) => patch({ domain: e.target.value })}
              placeholder="hammondco.com"
            />
          </Field>
          <Field label="Industry">
            <Input
              value={value.industry}
              onChange={(e) => patch({ industry: e.target.value })}
              placeholder="B2B SaaS, Creator, Agency…"
            />
          </Field>
          <Field label="Team size">
            <Select
              value={value.size || "__none"}
              onValueChange={(v) =>
                patch({ size: v === "__none" ? "" : (v as CompanySize) })
              }
            >
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">—</SelectItem>
                {SIZES.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </Section>

      <Section title="Links" description="Website, social, anything else. Flexible — add as many as you want.">
        <LinkEditor value={value.links} onChange={(links) => patch({ links })} />
      </Section>

      <Section title="Tags">
        <TagsField
          value={value.tags}
          onChange={(tags) => patch({ tags })}
        />
      </Section>

      <Section title="Notes">
        <Textarea
          value={value.notes}
          onChange={(e) => patch({ notes: e.target.value })}
          rows={4}
          placeholder="Anything worth remembering about this company — sales context, key relationships, account quirks."
        />
      </Section>
    </div>
  );
}

function Section({
  title, description, children,
}: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</h3>
        {description ? <p className="text-[11px] text-muted-foreground/80">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] text-muted-foreground">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
    </div>
  );
}

function TagsField({
  value, onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const { tagVocabulary } = useTemplates();
  const [draft, setDraft] = React.useState("");

  function add(tag: string) {
    const t = tag.trim().toLowerCase();
    if (!t || value.includes(t)) return;
    onChange([...value, t]);
    setDraft("");
  }
  const suggestions = tagVocabulary.filter((t) => !value.includes(t));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {value.length === 0 && (
          <span className="text-[12px] text-muted-foreground">No tags yet.</span>
        )}
        {value.map((t) => (
          <Badge key={t} variant="outline" className="gap-1 pr-1 text-[11px]">
            <Tag className="h-2.5 w-2.5" />
            {t}
            <button
              onClick={() => onChange(value.filter((x) => x !== t))}
              className="ml-0.5 rounded-sm p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label={`Remove ${t}`}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); add(draft); }
          }}
          placeholder="Add tag…"
          className="h-8 text-[12px]"
        />
        <Button variant="outline" size="sm" onClick={() => add(draft)} disabled={!draft.trim()}>
          <Plus className="h-3 w-3" /> Add
        </Button>
      </div>
      {suggestions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.slice(0, 8).map((t) => (
            <button
              key={t}
              onClick={() => add(t)}
              className="rounded-md border bg-muted/30 px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
            >
              {t}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
