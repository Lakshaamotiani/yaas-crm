import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Currency } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Per-currency display metadata. The symbol is used in compact contexts
 * (e.g. an input's leading badge); the locale picks the right thousands
 * separator. Intl.NumberFormat handles the actual symbol placement for
 * full-format output — we only need our own `symbol` for input adornments.
 */
export const CURRENCY_META: Record<Currency, { symbol: string; label: string; locale: string }> = {
  USD: { symbol: "$",   label: "USD", locale: "en-US" },
  INR: { symbol: "₹",   label: "INR", locale: "en-IN" },
  GBP: { symbol: "£",   label: "GBP", locale: "en-GB" },
  AED: { symbol: "AED", label: "AED", locale: "en-AE" }, // د.إ glyph reads poorly inline; spelled label is clearer
};

export const CURRENCY_OPTIONS: Currency[] = ["USD", "INR", "GBP", "AED"];

/**
 * Format any amount in any of our supported currencies. Compact mode (e.g.
 * `$4.5K`) kicks in once we cross 1k so dashboard tiles don't grow wider
 * than the column they live in.
 */
export function formatMoney(
  value: number | null | undefined,
  currency: Currency | null | undefined = "USD",
  opts?: { compact?: boolean },
) {
  const n = Number(value ?? 0);
  const cur: Currency = currency ?? "USD";
  const meta = CURRENCY_META[cur];
  if (opts?.compact && Math.abs(n) >= 1000) {
    return new Intl.NumberFormat(meta.locale, {
      style: "currency",
      currency: cur,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);
  }
  return new Intl.NumberFormat(meta.locale, {
    style: "currency",
    currency: cur,
    maximumFractionDigits: 0,
  }).format(n);
}

/**
 * INR formatter — default currency for YAAS Sales CRM.
 */
export function formatCurrency(value: number | null | undefined, opts?: { compact?: boolean }) {
  return formatMoney(value, "INR", opts);
}

/**
 * Cheap domain extractor. Accepts "hammondco.com", "https://hammondco.com",
 * "https://www.hammondco.com/about?x=1", etc. Returns the bare domain or
 * null if it can't make sense of the input.
 */
export function extractDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    return url.hostname.replace(/^www\./i, "") || null;
  } catch {
    return null;
  }
}

export function ensureHttps(url: string | null | undefined): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function initials(name: string | null | undefined) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Locale-stable date formatter. We avoid `toLocaleDateString()` here because
 * Node (server) and the browser (client) can be configured with different
 * default locales, which causes Next.js hydration mismatches (e.g.
 * "4/16/2026" on the server vs. "16/04/2026" in the browser).
 */
export function formatDate(
  date: string | Date | null | undefined,
  kind: "short" | "medium" | "long" | "day-only" = "medium",
): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  const day = d.getDate();
  const month = MONTHS_SHORT[d.getMonth()];
  const year = d.getFullYear();
  if (kind === "short") return `${month} ${day}`;
  if (kind === "day-only") return `${day}`;
  if (kind === "long") return `${WEEKDAYS_SHORT[d.getDay()]}, ${month} ${day}, ${year}`;
  return `${month} ${day}, ${year}`;
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${formatDate(d, "short")}, ${h}:${m} ${ampm}`;
}

export function relativeTime(date: string | Date | null | undefined) {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const sec = Math.round(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return formatDate(d, "medium");
}
