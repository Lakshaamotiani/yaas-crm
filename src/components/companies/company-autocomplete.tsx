"use client";

import * as React from "react";
import { Building2, Check, ChevronsUpDown, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useCompanies } from "@/lib/store";
import type { Company } from "@/lib/types";

/**
 * Combobox-style picker for companies. Three states:
 *   - empty: shows full list of companies + a "+ Create new" affordance.
 *   - existing match: picking it sets companyId.
 *   - no match: typing a brand-new name lets the parent know it should
 *     create a Company on submit (companyId stays null, draftName populated).
 */
export function CompanyAutocomplete({
  companyId, draftName, onSelect, onDraftChange,
}: {
  /** Currently-selected company id, or null if creating a new one / unset. */
  companyId: string | null;
  /** When companyId is null, the literal text the user typed. */
  draftName: string;
  /** Called when an existing company is picked. */
  onSelect: (id: string | null, company: Company | null) => void;
  /** Called as the user types — parent uses this to mark "will create new". */
  onDraftChange: (name: string) => void;
}) {
  const companies = useCompanies();
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const selected = companyId ? companies.find((c) => c.id === companyId) ?? null : null;
  const display = selected?.name ?? draftName;

  const q = search.trim().toLowerCase();
  const filtered = q
    ? companies.filter((c) => c.name.toLowerCase().includes(q) || (c.domain ?? "").toLowerCase().includes(q))
    : companies;

  const exactMatch = q
    ? companies.find((c) => c.name.toLowerCase() === q)
    : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="h-9 w-full justify-between gap-2 font-normal"
        >
          <span className="inline-flex min-w-0 items-center gap-2">
            <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className={cn("truncate text-left", !display && "text-muted-foreground")}>
              {display || "Pick or create a company…"}
            </span>
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <div className="border-b p-2">
          <Input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search or type a new company name…"
            className="h-8 text-[13px]"
          />
        </div>

        <ul className="max-h-[260px] overflow-y-auto p-1 scrollbar-thin">
          {filtered.length === 0 && !q ? (
            <li className="px-2 py-3 text-center text-[12px] text-muted-foreground">
              No companies yet.
            </li>
          ) : null}

          {filtered.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(c.id, c);
                  onDraftChange(c.name);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors",
                  companyId === c.id
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                <div className="grid h-6 w-6 shrink-0 place-items-center rounded border bg-muted text-[10px] font-medium">
                  {initials2(c.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-foreground">{c.name}</div>
                  {c.domain ? (
                    <div className="truncate text-[10px] text-muted-foreground">{c.domain}</div>
                  ) : null}
                </div>
                {companyId === c.id ? <Check className="h-3.5 w-3.5" /> : null}
              </button>
            </li>
          ))}
        </ul>

        {/* Inline "create new" affordance, only when query is non-empty and not an exact match */}
        {q && !exactMatch ? (
          <div className="border-t p-1">
            <button
              type="button"
              onClick={() => {
                onSelect(null, null);
                onDraftChange(search.trim());
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-foreground hover:bg-accent/60"
            >
              <Plus className="h-3.5 w-3.5 text-muted-foreground" />
              Create new company:&nbsp;<strong className="font-medium">{search.trim()}</strong>
            </button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function initials2(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
