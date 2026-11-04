// Fails when src/lib/marketing-feed.ts drifts from the tools/prices rendered by src/app/HomeClient.tsx.
// Usage: node scripts/check-marketing-feed.mjs
import { readFileSync } from "node:fs";

const home = readFileSync(new URL("../src/app/HomeClient.tsx", import.meta.url), "utf8");
const feed = readFileSync(new URL("../src/lib/marketing-feed.ts", import.meta.url), "utf8");
const errors = [];
const field = (line, name) => line.match(new RegExp(`${name}:\\s*(?:"((?:[^"\\\\]|\\\\.)*)"|(-?\\d+(?:\\.\\d+)?|null))`))?.slice(1).find((v) => v !== undefined);
const block = (src, start) => {
  const i = src.indexOf(start);
  if (i < 0) throw new Error(`Block not found: ${start}`);
  return src.slice(i, src.indexOf("\n];", i)).split("\n").filter((l) => l.trim().startsWith("{"));
};

const feedTools = new Map(block(feed, "const TOOLS").map((l) => [field(l, "path"), l]));
const feedByName = new Map(block(feed, "const TOOLS").map((l) => [field(l, "name"), l]));
const feedPlans = new Map(block(feed, "const PLANS").map((l) => [field(l, "name"), l]));

for (const l of block(home, "const tools:")) {
  const href = field(l, "href"), f = feedTools.get(href);
  if (!f) { errors.push(`Tool ${href} is on the homepage but missing from the feed`); continue; }
  if (field(f, "name") !== field(l, "title")) errors.push(`Name mismatch for ${href}`);
  if (field(f, "summary") !== field(l, "desc")) errors.push(`Description mismatch for ${href}`);
}
for (const l of block(home, "const individualTools:")) {
  const f = feedByName.get(field(l, "name"));
  if (!f) errors.push(`Individual tool ${field(l, "name")} missing from the feed`);
  else if (field(f, "individualGbp") !== field(l, "gbpPrice")) errors.push(`Individual price mismatch for ${field(l, "name")}`);
}
const periods = { oneTime: "one-time", perMonth: "month", perYear: "year" };
for (const l of block(home, "const pricing:")) {
  const f = feedPlans.get(field(l, "name"));
  if (!f) { errors.push(`Plan ${field(l, "name")} missing from the feed`); continue; }
  if (field(f, "priceGbp") !== field(l, "gbpPrice")) errors.push(`Plan price mismatch for ${field(l, "name")}`);
  if (field(f, "period") !== periods[field(l, "periodKey")]) errors.push(`Plan period mismatch for ${field(l, "name")}`);
}

if (errors.length) {
  console.error("Marketing feed drift:\n- " + errors.join("\n- "));
  process.exit(1);
}
console.log(`Marketing feed matches HomeClient.tsx (${feedTools.size} tools, ${feedPlans.size} plans).`);
