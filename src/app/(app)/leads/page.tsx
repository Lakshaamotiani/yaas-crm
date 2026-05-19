"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListView } from "@/components/pipeline/list-view";
import { useOverview } from "@/lib/store";

export default function LeadsPage() {
  const leads = useOverview();
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) =>
      [l.name, l.company?.name, l.company?.domain, l.email, l.role, l.service_type, ...(l.tags ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [leads, query]);

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        title="Leads"
        subtitle={`${filtered.length} total`}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/leads/new"><Plus /> Add Lead</Link>
          </Button>
        }
      />
      <div className="flex items-center gap-2 border-b px-4 py-3 sm:px-6">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search leads…"
            className="h-8 w-full pl-8 text-sm"
          />
        </div>
      </div>
      <ListView leads={filtered} />
    </div>
  );
}
