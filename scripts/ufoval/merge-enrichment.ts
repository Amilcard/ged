import fs from "fs";
import path from "path";

type Dep = { city: string; extra_eur: number };
type Sess = {
  date_text?: string;
  start_date?: string;
  end_date?: string;
  duration_days?: number;
  base_price_eur?: number;
  promo_price_eur?: number;
  raw?: string;
};

type DeparturesItem = {
  source_url: string;
  departures: Dep[];
};

type SessionsItem = {
  source_url?: string;
  sourceUrl?: string;
  url?: string;
  sessions: Sess[];
};

function readJson(p: string) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

const depPath = path.resolve(process.cwd(), "out/ufoval/ufoval_departures_prices.json");
const sesPath = path.resolve(process.cwd(), "out/ufoval/ufoval_sessions.json");

if (!fs.existsSync(depPath)) throw new Error("Missing departures file: " + depPath);
if (!fs.existsSync(sesPath)) throw new Error("Missing sessions file: " + sesPath);

const depItems = readJson(depPath) as DeparturesItem[];

const sesRoot = readJson(sesPath) as { results?: SessionsItem[] };
const sesItems = Array.isArray(sesRoot.results) ? sesRoot.results : [];

const sesByUrl = new Map<string, SessionsItem>();
for (const it of sesItems) {
  const u = (it.source_url || it.sourceUrl || it.url || "").trim();
  if (u) sesByUrl.set(u, it);
}

const merged = depItems.map(d => {
  const u = (d.source_url || "").trim();
  const s = u ? sesByUrl.get(u) : undefined;
  return {
    source_url: u,
    departures: Array.isArray(d.departures) ? d.departures : [],
    sessions: Array.isArray(s?.sessions) ? s!.sessions : [],
    meta: {
      has_departures: Array.isArray(d.departures) && d.departures.length > 0,
      sessions_count: Array.isArray(s?.sessions) ? s!.sessions.length : 0
    }
  };
});

const total = merged.length;
const okSessions = merged.filter(x => x.sessions.length > 0).length;
const okDepartures = merged.filter(x => x.departures.length > 0).length;

const out = {
  ok: true,
  generatedAt: new Date().toISOString(),
  total,
  stats: { okDepartures, okSessions, missingSessions: total - okSessions },
  items: merged
};

const outPath = path.resolve(process.cwd(), "out/ufoval/ufoval_enrichment_full.json");
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
console.log("DONE ->", outPath);
console.log("stats:", out.stats);
