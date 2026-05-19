"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  CompanyForm, emptyCompanyForm, formToCompanyPatch,
} from "@/components/companies/company-form";
import { useActions } from "@/lib/store";

export default function NewCompanyPage() {
  const router = useRouter();
  const actions = useActions();
  const [form, setForm] = React.useState(emptyCompanyForm);
  const canSubmit = form.name.trim().length > 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) {
      toast.error("Name is required");
      return;
    }
    const patch = formToCompanyPatch(form);
    const id = actions.createCompany(patch);
    toast.success("Company created");
    router.push(`/companies/${id}`);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        title="New Company"
        subtitle="Create an account you sell to. You can attach contacts to it after."
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link href="/companies"><ArrowLeft /> Back</Link>
          </Button>
        }
      />

      <form onSubmit={submit} className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <CompanyForm value={form} onChange={setForm} />

        <div className="mt-8 flex items-center justify-end gap-2 border-t pt-5">
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSubmit}>Create company</Button>
        </div>
      </form>
    </div>
  );
}
