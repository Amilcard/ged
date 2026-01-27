/**
 * UFOVAL - Extract sessions (dates + prices) from stay pages
 * SAFE: no DB write. Output JSON only.
 *
 * Input:  out/ufoval/rewrite_ready_for_supabase.json (array with source_url)
 * Output: out/ufoval/ufoval_sessions.json
 * Debug:  out/ufoval/_debug_html_sessions/*.html
 */
import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";

type SessionRow = {
  start_date?: string;     // ISO if possible
  end_date?: string;       // ISO if possible
  date_text?: string;      // raw
  duration_days?: number | null;
  base_price_eur?: number | null;
  promo_price_eur?: number | null;
  raw?: string;
};

type Result = {
  id?: string;
  source_url: string;
  ok: boolean;
  sessions: SessionRow[];
  error?: string;
};

const INPUT = path.resolve("out/ufoval/rewrite_ready_for_supabase.json");
const OUTPUT = path.resolve("out/ufoval/ufoval_sessions.json");
const DEBUG_DIR = path.resolve("out/ufoval/_debug_html_sessions");

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readJson(p: string) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p: string, data: any) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf8");
}

function norm(s: string) {
  return String(s ?? "").replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
}

function euroToNumber(s: string): number | null {
  const t = norm(s).replace("€", "");
  const m = t.match(/(\d{1,3}(?:[ .]\d{3})*|\d+)(?:[,.](\d{1,2}))?/);
  if (!m) return null;
  const intPart = m[1].replace(/[ .]/g, "");
  const decPart = m[2] ? m[2] : "0";
  const n = Number(`${intPart}.${decPart}`);
  return Number.isFinite(n) ? n : null;
}

function parseDurationDays(text: string): number | null {
  const t = norm(text).toLowerCase();
  const m = t.match(/(\d+)\s*(jour|jours|j)\b/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/**
 * Try to detect "table" style sessions:
 * headers like Dates / Tarif / Réduit, etc.
 */
function extractFromTables($: cheerio.CheerioAPI): SessionRow[] {
  let best: SessionRow[] = [];

  $("table").each((_, table) => {
    const headers: string[] = [];
    $(table).find("thead th").each((__, th) => headers.push(norm($(th).text())));
    const h = headers.join(" | ").toLowerCase();

    const looks =
      (h.includes("tarif") && (h.includes("réduit") || h.includes("reduit") || h.includes("normal"))) ||
      (h.includes("dates") && h.includes("tarif"));
    if (!looks) return;

    const rows: SessionRow[] = [];
    $(table).find("tbody tr").each((__, tr) => {
      const cells: string[] = [];
      $(tr).find("td").each((___, td) => cells.push(norm($(td).text())));
      if (cells.filter(Boolean).length < 2) return;

      const raw = cells.join(" | ");
      const euros = cells.filter((c) => c.includes("€"));
      const base = euros[0] ? euroToNumber(euros[0]) : null;
      const promo = euros[1] ? euroToNumber(euros[1]) : null;

      const dateCell =
        cells.find((c) => /(\d{1,2}\/\d{1,2})\s*-\s*(\d{1,2}\/\d{1,2})/.test(c)) ||
        cells.find((c) => /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(c)) ||
        cells.find((c) => /\d{1,2}\s+\w+/i.test(c)) ||
        cells[0] || "";

      rows.push({
        date_text: dateCell || raw,
        duration_days: parseDurationDays(raw),
        base_price_eur: base,
        promo_price_eur: promo,
        raw,
      });
    });

    if (rows.length > best.length) best = rows;
  });

  return best;
}

/**
 * Try to detect "cards" style sessions:
 * blocks containing a date range + prices.
 */
function extractFromCards($: cheerio.CheerioAPI): SessionRow[] {
  const candidates: SessionRow[] = [];
  const text = norm($("body").text());

  // Heuristic: scan for lines containing "€" and something that looks like a date
  // We do it DOM-based to keep some structure:
  const blocks = $("body").find("li, .card, .bloc, .row, .item, div").slice(0, 2500);
  blocks.each((_, el) => {
    const t = norm($(el).text());
    if (!t || t.length < 20) return;
    if (!t.includes("€")) return;
    const hasDate = /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(t) || /\d{1,2}\s+\w+/i.test(t);
    if (!hasDate) return;

    const euros = t.split(" ").filter((x) => x.includes("€"));
    // better: search prices inside whole text
    const allPrices = Array.from(t.matchAll(/(\d{1,3}(?:[ .]\d{3})*|\d+)(?:[,.]\d{1,2})?\s*€/g)).map(m=>m[0]);
    const base = allPrices[0] ? euroToNumber(allPrices[0]) : null;
    const promo = allPrices[1] ? euroToNumber(allPrices[1]) : null;

    candidates.push({
      date_text: t,
      duration_days: parseDurationDays(t),
      base_price_eur: base,
      promo_price_eur: promo,
      raw: t,
    });
  });

  // Deduplicate by raw
  const seen = new Set<string>();
  const out: SessionRow[] = [];
  for (const c of candidates) {
    const key = c.raw || "";
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }

  // Keep top N most plausible (avoid huge)
  return out.slice(0, 25);
}

async function fetchHtml(url: string) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; GED-UFOVAL-Sessions/1.0)",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "fr-FR,fr;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

async function main() {
  if (!fs.existsSync(INPUT)) {
    console.error("Missing input:", INPUT);
    process.exit(1);
  }

  ensureDir(path.dirname(OUTPUT));
  ensureDir(DEBUG_DIR);

  const stays = readJson(INPUT) as any[];
  const urls = stays.map((s) => s.source_url).filter(Boolean);

  const results: Result[] = [];
  let okCount = 0;

  for (let i = 0; i < stays.length; i++) {
    const s = stays[i];
    const url = s.source_url;
    const id = s.id || s.slug || `idx_${i}`;
    if (!url) {
      results.push({ id, source_url: "", ok: false, sessions: [], error: "no_source_url" });
      continue;
    }
    console.log(`[${i + 1}/${stays.length}]`, id);

    try {
      const html = await fetchHtml(url);
      const safeName = String(id).replace(/[^a-z0-9_-]+/gi, "_");
      fs.writeFileSync(path.join(DEBUG_DIR, `${safeName}.html`), html, "utf8");

      const $ = cheerio.load(html);
      const fromTables = extractFromTables($);
      const fromCards = fromTables.length ? [] : extractFromCards($);
      const sessions = (fromTables.length ? fromTables : fromCards).filter(Boolean);

      const ok = sessions.length > 0;
      if (ok) okCount++;
      results.push({ id, source_url: url, ok, sessions });
    } catch (e: any) {
      results.push({ id, source_url: url, ok: false, sessions: [], error: String(e?.message || e) });
    }
  }

  writeJson(OUTPUT, {
    generatedAt: new Date().toISOString(),
    total: stays.length,
    ok: okCount,
    results,
  });

  console.log("DONE ->", OUTPUT, "ok:", okCount, "/", stays.length);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
