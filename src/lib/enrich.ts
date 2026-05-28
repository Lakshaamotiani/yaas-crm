/**
 * Free company enrichment — no external APIs, no cost.
 *
 * Fetches the company website + a DuckDuckGo search snippet and scans for
 * funding / revenue signals. Returns a fit score (0–100) and a short reason
 * the founder can read at a glance in the Inbox.
 */

export interface EnrichResult {
  fit_score: number;          // 0 | 25 | 50 | 75 | 100
  qualified: boolean;         // true if score >= 50
  signals: string[];          // human-readable signal lines
  summary: string;            // one-line verdict for the Inbox badge
}

// ── Signal definitions ────────────────────────────────────────────────────────

const FUNDING_PATTERNS = [
  /series\s+[a-e]/i,
  /seed\s+(round|fund|stage|investment)/i,
  /raised?\s+[\$₹€£]/i,
  /raised?\s+[\d.,]+\s*(million|crore|lakh|cr\b|mn\b)/i,
  /\b(sequoia|accel|tiger global|softbank|lightspeed|matrix|nexus|blume|elevation|kalaari|chiratae|india quotient|better capital)\b/i,
  /\bvc\s+backed\b/i,
  /\bventure[- ]backed\b/i,
  /\bfunded\s+by\b/i,
  /\binvestors?\b.{0,60}(include|are|:)/i,
  /\bportfolio\s+company\b/i,
];

const REVENUE_PATTERNS = [
  /\b[\d,]+\s*crore\b/i,
  /\b[\d,]+\s*cr\b/i,
  /annual\s+revenue/i,
  /\barr\b.{0,20}[\$₹€]/i,
  /\bmrr\b.{0,20}[\$₹€]/i,
  /revenue\s+(of|crossed|reached|hit)\s+[\$₹€\d]/i,
  /\b(profitable|profitability|cashflow positive)\b/i,
];

const SCALE_PATTERNS = [
  /\b\d{3,}[,\s]?\d*\s*(employees?|people|team members?|staff)\b/i,
  /team\s+of\s+\d{2,}/i,
  /\b(enterprise|fortune 500|large\s+enterprise)\b/i,
  /\d+\s+cities/i,
  /\d+\s+(countries|markets)/i,
  /\d+[km+]\s*(users?|customers?|downloads?|subscribers?)/i,
];

const DISQUALIFY_PATTERNS = [
  /\b(freelancer|solopreneur|solo\s+founder|one[- ]person)\b/i,
  /just\s+(launched|started|founded)\b/i,
  /\bbootstrapped\b/i,         // not a hard disqualifier but a signal
  /\bno\s+funding\b/i,
  /\bpre[- ]revenue\b/i,
  /\bstealth\s+mode\b/i,
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchText(url: string, timeoutMs = 6000): Promise<string> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; YaasCRM/1.0)" },
    });
    clearTimeout(t);
    const raw = await res.text();
    // Strip tags + collapse whitespace for cleaner scanning
    return raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 50_000);
  } catch {
    clearTimeout(t);
    return "";
  }
}

function countMatches(text: string, patterns: RegExp[]): string[] {
  const hits: string[] = [];
  for (const re of patterns) {
    const m = re.exec(text);
    if (m) hits.push(m[0].trim().slice(0, 80));
  }
  return hits;
}

function normaliseUrl(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    return u.origin;               // drop path — scan homepage only
  } catch {
    return null;
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function enrichCompany(
  companyName: string | null,
  websiteUrl: string | null,
  youtubeLink: string | null,
): Promise<EnrichResult> {
  const signals: string[] = [];
  let score = 0;

  const siteUrl = normaliseUrl(websiteUrl);

  // Fetch website text
  const siteText = siteUrl ? await fetchText(siteUrl) : "";

  // Fetch DuckDuckGo HTML search for "[company] funding raised"
  const query = encodeURIComponent(`${companyName ?? ""} funding raised India`);
  const ddgText = companyName
    ? await fetchText(`https://html.duckduckgo.com/html/?q=${query}`, 5000)
    : "";

  const corpus = `${siteText} ${ddgText}`;

  // ── Score signals ──────────────────────────────────────────────────────────

  const fundingHits = countMatches(corpus, FUNDING_PATTERNS);
  if (fundingHits.length > 0) {
    score += 50;
    signals.push(`💰 Funding signal: "${fundingHits[0]}"`);
  }

  const revenueHits = countMatches(corpus, REVENUE_PATTERNS);
  if (revenueHits.length > 0) {
    score += 25;
    signals.push(`📈 Revenue signal: "${revenueHits[0]}"`);
  }

  const scaleHits = countMatches(corpus, SCALE_PATTERNS);
  if (scaleHits.length > 0) {
    score += 15;
    signals.push(`🏢 Scale signal: "${scaleHits[0]}"`);
  }

  if (youtubeLink) {
    score += 10;
    signals.push("▶️ Already has a YouTube channel");
  }

  const disqualifyHits = countMatches(corpus, DISQUALIFY_PATTERNS);
  if (disqualifyHits.length > 0 && score < 30) {
    score = Math.max(0, score - 20);
    signals.push(`⚠️ Low-fit signal: "${disqualifyHits[0]}"`);
  }

  // Cap at 100
  score = Math.min(100, score);

  // ── Verdict ────────────────────────────────────────────────────────────────

  const qualified = score >= 50;
  let summary: string;

  if (score >= 75)      summary = "✅ Strong fit — funded / at scale";
  else if (score >= 50) summary = "✅ Likely qualified — some signals found";
  else if (score >= 25) summary = "⚠️ Weak signals — review manually";
  else                  summary = "❌ No qualification signals found";

  if (signals.length === 0) signals.push("No public signals found — review manually");

  return { fit_score: score, qualified, signals, summary };
}
