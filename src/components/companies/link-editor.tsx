"use client";

import * as React from "react";
import { Plus, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { CompanyLink, CompanyLinkType } from "@/lib/types";
import { cn, ensureHttps } from "@/lib/utils";
import { LINK_TYPES, LINK_META } from "./link-meta";

const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * Editable list of typed external links. Each company can have any number
 * of links of any type (or "other" for one-offs). Used by:
 *   - CompanyForm (settings, /companies/new, /companies/[id])
 *   - LeadForm (lazy creation of company on submit)
 */
export function LinkEditor({
  value, onChange, className,
}: {
  value: CompanyLink[];
  onChange: (next: CompanyLink[]) => void;
  className?: string;
}) {
  function patch(idx: number, p: Partial<CompanyLink>) {
    onChange(value.map((l, i) => (i === idx ? { ...l, ...p } : l)));
  }
  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }
  function add(type: CompanyLinkType = "website") {
    onChange([...value, { id: uid(), type, url: "" }]);
  }

  return (
    <div className={cn("space-y-2", className)}>
      {value.length === 0 ? (
        <div className="rounded-md border border-dashed px-3 py-4 text-center text-[12px] text-muted-foreground">
          No links yet. Use “+ Add link” to attach a website, social, or anything else.
        </div>
      ) : null}

      <ul className="space-y-1.5">
        {value.map((link, i) => {
          const meta = LINK_META[link.type];
          const Icon = meta.icon;
          return (
            <li
              key={link.id}
              className="group grid grid-cols-[120px_minmax(0,1fr)_28px_28px] items-center gap-2 rounded-md border bg-card px-2 py-1.5"
            >
              <Select
                value={link.type}
                onValueChange={(v: CompanyLinkType) => patch(i, { type: v })}
              >
                <SelectTrigger className="h-8 gap-1.5 px-2 text-[12px]">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LINK_TYPES.map((t) => {
                    const ItemIcon = t.icon;
                    return (
                      <SelectItem key={t.id} value={t.id}>
                        <span className="inline-flex items-center gap-2">
                          <ItemIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          {t.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              <div className="space-y-0.5">
                <Input
                  value={link.url}
                  onChange={(e) => patch(i, { url: e.target.value })}
                  placeholder="https://…"
                  className="h-8 text-[12px]"
                />
                {link.type === "other" || link.label ? (
                  <Input
                    value={link.label ?? ""}
                    onChange={(e) => patch(i, { label: e.target.value || null })}
                    placeholder="Label (optional, e.g. 'Founder personal X')"
                    className="h-6 border-0 bg-transparent px-1 text-[11px] italic shadow-none focus-visible:ring-0"
                  />
                ) : null}
              </div>

              {link.url ? (
                <a
                  href={ensureHttps(link.url)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label="Open link"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : <span />}

              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => remove(i)}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Remove link"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          );
        })}
      </ul>

      <Button
        variant="outline"
        size="sm"
        onClick={() => add("website")}
        className="w-full"
      >
        <Plus className="h-3.5 w-3.5" /> Add link
      </Button>
    </div>
  );
}

/**
 * Read-only compact display of a company's links — used on the lead-detail
 * sidebar and company profile.
 */
export function LinkList({
  links, className,
}: { links: CompanyLink[]; className?: string }) {
  if (links.length === 0) {
    return (
      <p className={cn("text-[12px] text-muted-foreground", className)}>
        No links on file.
      </p>
    );
  }
  return (
    <ul className={cn("space-y-1.5", className)}>
      {links.map((l) => {
        const meta = LINK_META[l.type];
        const Icon = meta.icon;
        const display = l.label?.trim() || prettyUrl(l.url) || l.url;
        return (
          <li key={l.id} className="group flex items-center gap-2">
            <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <a
              href={ensureHttps(l.url)}
              target="_blank"
              rel="noreferrer"
              className="min-w-0 flex-1 truncate text-[12px] text-foreground transition-colors hover:underline"
              title={l.url}
            >
              {display}
            </a>
            <a
              href={ensureHttps(l.url)}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
              aria-label="Open link"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}

function prettyUrl(url: string): string | null {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname === "/" ? "" : u.pathname}`;
  } catch {
    return null;
  }
}
