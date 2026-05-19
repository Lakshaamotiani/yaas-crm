"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useActions, useCompany, useTemplates } from "@/lib/store";
import { SERVICE_TYPES } from "@/lib/constants";
import { CompanyAutocomplete } from "@/components/companies/company-autocomplete";
import { LinkEditor } from "@/components/companies/link-editor";
import type { CompanyLink } from "@/lib/types";

export default function NewLeadPage() {
  // useSearchParams() needs a Suspense boundary at the static-prerender step.
  return (
    <React.Suspense fallback={null}>
      <NewLeadInner />
    </React.Suspense>
  );
}

function NewLeadInner() {
  const router = useRouter();
  const actions = useActions();
  const searchParams = useSearchParams();
  const presetCompanyId = searchParams.get("company");
  const { sourceLabels } = useTemplates();
  const presetCompany = useCompany(presetCompanyId);

  const [form, setForm] = React.useState({
    name: "",
    email: "",
    phone: "",
    role: "",
    service_type: "" as any,
    additional_info: "",
    source: "yaas_form" as const,
  });

  // Company state — three cases handled together:
  //   1. companyId is set → existing company
  //   2. companyId null + draftName set → will create on submit
  //   3. both empty → no company assigned
  const [companyId, setCompanyId] = React.useState<string | null>(presetCompanyId);
  const [draftName, setDraftName] = React.useState<string>(presetCompany?.name ?? "");
  // Optional fields used only when creating a new company on the fly:
  const [newCompanyWebsite, setNewCompanyWebsite] = React.useState("");
  const [newCompanyLinks, setNewCompanyLinks] = React.useState<CompanyLink[]>([]);

  // When the preset company resolves async (mock store hydrates after mount)
  // keep the draft name in sync.
  React.useEffect(() => {
    if (presetCompany && presetCompanyId === companyId) {
      setDraftName(presetCompany.name);
    }
  }, [presetCompany, presetCompanyId, companyId]);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }

    // Resolve company: either existing id or find-or-create from the typed name.
    let resolvedCompanyId = companyId;
    if (!resolvedCompanyId && draftName.trim()) {
      resolvedCompanyId = actions.findOrCreateCompany({
        name: draftName.trim(),
        website: newCompanyWebsite.trim() || undefined,
        links: newCompanyLinks,
      });
    }

    const id = actions.createLead({
      name: form.name,
      email: form.email || null,
      phone: form.phone || null,
      role: form.role || null,
      service_type: (form.service_type || null) as any,
      additional_info: form.additional_info || null,
      source: form.source,
      company_id: resolvedCompanyId,
    });
    toast.success("Lead created");
    router.push(`/leads/${id}`);
  }

  const isCreatingNewCompany = !companyId && draftName.trim().length > 0;

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        title="New Lead"
        subtitle="Add a contact. Companies hold the website/social links — you can attach to an existing company or create one inline."
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link href="/pipeline"><ArrowLeft /> Back</Link>
          </Button>
        }
      />
      <form onSubmit={onSubmit} className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="grid gap-5">
          <Section title="Contact">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Full name" required>
                <Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Jane Doe" />
              </Field>
              <Field label="Role">
                <Input value={form.role} onChange={(e) => update("role", e.target.value)} placeholder="Founder" />
              </Field>
              <Field label="Email">
                <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="jane@company.com" />
              </Field>
              <Field label="Phone">
                <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+1 555 0100" />
              </Field>
            </div>
          </Section>

          <Section title="Company">
            <Field label="Company">
              <CompanyAutocomplete
                companyId={companyId}
                draftName={draftName}
                onSelect={(id) => setCompanyId(id)}
                onDraftChange={(name) => {
                  setDraftName(name);
                  if (!name) setCompanyId(null);
                }}
              />
            </Field>

            {isCreatingNewCompany ? (
              <div className="space-y-3 rounded-md border border-dashed bg-muted/20 p-3">
                <p className="text-[11px] text-muted-foreground">
                  Creating a new company: <strong className="font-medium text-foreground">{draftName}</strong>. Add a website + any social links — you can refine the rest on the company profile after.
                </p>
                <Field label="Website (optional)">
                  <Input
                    value={newCompanyWebsite}
                    onChange={(e) => setNewCompanyWebsite(e.target.value)}
                    placeholder="acme.com"
                  />
                </Field>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Other links (optional)</Label>
                  <LinkEditor value={newCompanyLinks} onChange={setNewCompanyLinks} />
                </div>
              </div>
            ) : null}
          </Section>

          <Section title="Interest">
            <Field label="Service type">
              <Select
                value={form.service_type}
                onValueChange={(v) => update("service_type", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a service" />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_TYPES.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Additional info">
              <Textarea
                value={form.additional_info}
                onChange={(e) => update("additional_info", e.target.value)}
                rows={3}
                placeholder="Anything else worth knowing"
              />
            </Field>
            <Field label="Source">
              <Select value={form.source} onValueChange={(v: any) => update("source", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(sourceLabels).map(([id, label]) => (
                    <SelectItem key={id} value={id}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </Section>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit">Create lead</Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
    </div>
  );
}
