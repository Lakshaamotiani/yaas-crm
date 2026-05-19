"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CURRENCY_META, CURRENCY_OPTIONS } from "@/lib/utils";
import type { Currency } from "@/lib/types";

/**
 * Currency selector + amount input, rendered as a single segmented control.
 * Used for both qualification budget and deal MRR/one-time.
 *
 * Why one component:
 *   - Visual consistency across every money-entry surface.
 *   - Single source of truth for parsing/formatting the amount, so we don't
 *     have to repeat "blank → null, otherwise Number()" logic everywhere.
 */
export function MoneyInput({
  amount,
  currency,
  onAmountChange,
  onCurrencyChange,
  placeholder = "0",
  disabled,
  className,
  inputId,
}: {
  amount: number | null;
  currency: Currency;
  onAmountChange: (next: number | null) => void;
  onCurrencyChange: (next: Currency) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  inputId?: string;
}) {
  const [draft, setDraft] = React.useState(amount === null ? "" : String(amount));

  // Keep the input synced when the upstream amount changes (e.g. after an
  // optimistic-reconcile pass returns a slightly normalized value).
  React.useEffect(() => {
    setDraft(amount === null ? "" : String(amount));
  }, [amount]);

  function commit(nextRaw: string) {
    const trimmed = nextRaw.trim();
    if (trimmed === "") {
      onAmountChange(null);
      return;
    }
    const parsed = Number(trimmed.replace(/[^0-9.]/g, ""));
    if (Number.isFinite(parsed)) onAmountChange(parsed);
  }

  return (
    <div
      className={cn(
        "flex h-9 items-stretch rounded-md border border-input bg-background shadow-[0_1px_0_0_rgba(0,0,0,0.02)] focus-within:border-foreground/30 focus-within:ring-1 focus-within:ring-ring/30",
        disabled && "opacity-50",
        className,
      )}
    >
      <Select value={currency} onValueChange={(v) => onCurrencyChange(v as Currency)} disabled={disabled}>
        <SelectTrigger
          aria-label={`Currency: ${CURRENCY_META[currency].label}`}
          // Symbol-only trigger keeps the input compact; the open menu shows
          // the full ISO code (USD, INR, …) so the choice isn't ambiguous.
          // Width tuned so "AED" (the widest symbol) sits next to the chevron
          // without crowding.
          className="h-full w-[72px] shrink-0 rounded-none rounded-l-md border-0 border-r border-input bg-transparent px-2.5 text-[13px] font-mono font-medium tabular-nums shadow-none focus:ring-0"
        >
          <span className="text-foreground">{CURRENCY_META[currency].symbol}</span>
        </SelectTrigger>
        <SelectContent>
          {CURRENCY_OPTIONS.map((c) => (
            <SelectItem key={c} value={c} className="text-[13px]">
              <span className="inline-flex items-center gap-2 font-mono tabular-nums">
                <span className="inline-block w-8 text-foreground">{CURRENCY_META[c].symbol}</span>
                <span className="text-muted-foreground">{CURRENCY_META[c].label}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        id={inputId}
        type="text"
        inputMode="decimal"
        value={draft}
        placeholder={placeholder}
        onChange={(e) => {
          setDraft(e.target.value);
        }}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
        }}
        disabled={disabled}
        className="h-full flex-1 rounded-l-none border-0 bg-transparent font-mono tabular-nums shadow-none focus-visible:border-0 focus-visible:ring-0"
      />
    </div>
  );
}
