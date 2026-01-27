// scripts/ufoval/extract-departures-and-prices.ts
import fs from "fs";

type Row = {
  source_url: string;
  title?: string;
  sessions: Array<{
    dates: string;      // "04/07 - 17/07"
    duration?: string;  // "14 jours"
    price?: string;     // "1 155 €"
    early?: string;     // "1 063 €"
  }>;
  departures: Array<{ city: string; extra_eur?: number | null }>;
};

function clean(s: string) {
  return s.replace(/\s+/g, " ").replace(/\u00a0/g, " ").trim();
}

function parseEuroToNumber(s: string): number | null {
  const m = clean(s).match(/(\d[\d\s]*)\s*€?/);
  if (!m) return null;
  return Number(m[1].replace(/\s/g, ""));
}

function extractSessions(html: string) {
  // On vise les lignes du tableau "Dates de séjour"
  // On reste volontairement tolérant: on récupère les segments "dd/dd - dd/dd", "X jours", "€", "€"
  const out: Row["sessions"] = [];
  const tableBlock = html.split("Dates de séjour")[1] ?? "";
  const lines = tableBlock.split("\n").map(clean).filter(Boolean);

  // Ex: "04/07 - 17/07 14 jours 1 155 € 1 063 €"
  for (const line of lines) {
    const m = line.match(/(\d{2}\/\d{2}\s*-\s*\d{2}\/\d{2})\s*(\d+\s+jours)?\s*([\d\s]+\s*€)\s*([\d\s]+\s*€)?/);
    if (m) {
      out.push({
        dates: m[1],
        duration: m[2] ? clean(m[2]) : undefined,
        price: m[3] ? clean(m[3]) : undefined,
        early: m[4] ? clean(m[4]) : undefined,
      });
    }
    // stop si on sort de la zone
    if (line.includes("S'inscrire") || line.includes("Réserver")) break;
  }
  // Dédup basique
  return out.filter((v, i, a) => a.findIndex(x => x.dates === v.dates && x.price === v.price) === i);
}

function extractDepartures(html: string) {
  // bloc "Ville de départ" puis une chaîne du style:
  // "Sans transport albertville (170 €)annecy (170 €)..."
  const out: Row["departures"] = [];
  const after = html.split("Ville de départ")[1] ?? "";
  const snippet = clean(after.slice(0, 2000));

  // "Sans transport" = entrée spéciale
  if (snippet.toLowerCase().includes("sans transport")) {
    out.push({ city: "Sans transport", extra_eur: 0 });
  }

  // match "ville (123 €)" collé ou espacé
  const re = /([a-zA-ZÀ-ÿ' -]{2,})\s*\((\d[\d\s]*)\s*€\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(snippet))) {
    const city = clean(m[1]).replace(/\s+/g, " ");
    const extra = parseEuroToNumber(m[2] + " €");
    // éviter doublons
    if (!out.some(x => x.city.toLowerCase() === city.toLowerCase())) {
      out.push({ city, extra_eur: extra });
    }
  }
  return out;
}

async function main() {
  const input = "out/ufoval/rewrite_ready_for_supabase.json";
  const j = JSON.parse(fs.readFileSync(input, "utf8"));
  const urls: string[] = j.map((x: any) => x.source_url).filter(Boolean);

  const rows: Row[] = [];
  for (const url of urls) {
    const res = await fetch(url, { redirect: "follow" });
    const html = await res.text();

    // titre h1 souvent présent
    const title = (html.match(/<h1[^>]*>\s*([^<]+)\s*<\/h1>/i)?.[1] ?? "").trim();

    rows.push({
      source_url: url,
      title: title || undefined,
      sessions: extractSessions(html),
      departures: extractDepartures(html),
    });
  }

  fs.writeFileSync("out/ufoval/ufoval_departures_prices.json", JSON.stringify(rows, null, 2), "utf8");

  // mini résumé console (lisible)
  console.log("Export OK -> out/ufoval/ufoval_departures_prices.json");
  console.log("Rows:", rows.length);
  console.log("Sample:", rows[0]?.title, rows[0]?.sessions?.[0], rows[0]?.departures?.slice(0, 5));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
