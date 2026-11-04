// Public, read-only marketing feed consumed by the ANDY'K LAB Marketing Studio.
//
// Only facts that are already shown publicly on lab.djandykofficial.com belong here: no customer data,
// no secrets, no unreleased tools. Names, prices and plan grants must stay identical to HomeClient.tsx
// and PLAN_TOOLS — `node scripts/check-marketing-feed.mjs` fails if they drift.
//
// To publish a change: edit the data below and bump FEED_VERSION. The Studio stores every distinct
// version it receives and announces each entry in `updates` at most once.

import { createHmac } from "node:crypto";
import { PLAN_TOOLS } from "@/lib/access";

export const FEED_SCHEMA = "andyk-lab-marketing-feed";
export const FEED_SCHEMA_VERSION = 1;
export const FEED_VERSION = "2026-11-03.1";

const SITE_URL = "https://lab.djandykofficial.com";

type Period = "one-time" | "month" | "year";

const TOOLS: { id: string; name: string; path: string; summary: string; individualGbp: number | null }[] = [
  { id: "mastering", name: "Mastering Tool", path: "/mastering", individualGbp: 19, summary: "Normalize to -14 LUFS (Spotify standard), apply EQ, stereo widening, and limit to -0.3 dBTP. Includes A/B waveform compare, presets, and reference track analysis." },
  { id: "bpm", name: "BPM + Key Detector", path: "/bpm", individualGbp: 9, summary: "Instant BPM via autocorrelation, musical key via Krumhansl-Schmuckler, Camelot wheel, Tap BPM, danceability score, and analysis history." },
  { id: "planner", name: "DJ Set Planner", path: "/planner", individualGbp: 12, summary: "Drag & drop tracks, auto-sort by Camelot key, visualise energy flow, see transition quality labels, and export your set." },
  { id: "track-comparator", name: "Track Comparator", path: "/track-comparator", individualGbp: 9, summary: "Upload two tracks and compare waveforms, LUFS levels, and frequency content side-by-side. Spot the mix differences instantly." },
  { id: "chord-generator", name: "Chord Generator", path: "/chord-generator", individualGbp: 9, summary: "Generate chord progressions in any key, explore voicings, and preview how chords sound together — built for producers and songwriters." },
  { id: "metronome", name: "Metronome", path: "/metronome", individualGbp: 3, summary: "Precision browser metronome with adjustable BPM, time signatures, accent patterns, and tap tempo — zero latency via Web Audio API." },
  { id: "loudness-meter", name: "Loudness Meter", path: "/loudness-meter", individualGbp: 9, summary: "Real-time LUFS, RMS, and true-peak metering in your browser. Measure loudness against Spotify, Apple Music, and YouTube targets." },
  { id: "stem-splitter", name: "Stem Splitter", path: "/stem-splitter", individualGbp: 12, summary: "Separate vocals, drums, bass, and other stems from any track — entirely in the browser. No uploads, no servers, complete privacy." },
  { id: "audio-converter", name: "Audio Converter", path: "/audio-converter", individualGbp: null, summary: "Convert between audio formats — WAV, MP3, FLAC, AAC input to WAV or MP3 output. 100% browser-based, nothing uploaded." },
];

const PLANS: { id: string; name: string; priceGbp: number; period: Period; summary: string; features: string[] }[] = [
  { id: "single", name: "Single Session", priceGbp: 79, period: "one-time", summary: "One professional mastering session for a single track.", features: ["1 track mastered", "-14 LUFS / -0.3 dBTP", "WAV + MP3 download", "24h turnaround"] },
  { id: "studio", name: "Studio Pass", priceGbp: 49, period: "month", summary: "For producers releasing regularly.", features: ["Unlimited masterings", "BPM + Key detector", "DJ Set Planner", "Priority processing", "Stem separation"] },
  // "Save £149 vs monthly" is intentionally omitted: it does not match 12 × £49 − £199 and needs owner review.
  { id: "pro", name: "Pro Pass", priceGbp: 199, period: "year", summary: "Everything in Studio Pass — billed annually.", features: ["All Studio Pass features", "Early access to new tools", "Label export formats", "Dedicated support", "Audio Converter — only from DJ Andy’K, free exclusively with Pro Pass"] },
];

// Public release notes. Only add entries for changes that are already live on the website.
const UPDATES: { id: string; toolId: string | null; title: string; summary: string; publishedOn: string }[] = [
  { id: "2026-06-29-audio-converter", toolId: "audio-converter", title: "Audio Converter added to Pro Pass", summary: "Convert WAV, MP3, FLAC and AAC files to WAV or MP3 in the browser. Included exclusively with Pro Pass.", publishedOn: "2026-06-29" },
  { id: "2026-06-29-mastering-djandyk-preset", toolId: "mastering", title: "DJ Andy'K Master preset", summary: "The Mastering Tool now includes a DJ Andy'K Master preset.", publishedOn: "2026-06-29" },
];

const ASSETS: { id: string; path: string; kind: string; mimeType: string; width: number; height: number }[] = [
  { id: "og-image", path: "/og-image.jpg", kind: "brand-image", mimeType: "image/jpeg", width: 1200, height: 630 },
];

export function buildMarketingFeed() {
  return {
    schema: FEED_SCHEMA,
    schemaVersion: FEED_SCHEMA_VERSION,
    version: FEED_VERSION,
    site: {
      name: "Andy'K Music Lab",
      url: SITE_URL,
      instagram: "https://www.instagram.com/andykmusiclab/",
      processing: "Your audio stays entirely in your browser — 100% private, never sent to any server.",
    },
    pricing: {
      currency: "GBP",
      notes: [
        "Prices shown in GBP. Other currencies are approximate. Final amount charged in GBP by Revolut Business.",
        "VAT/tax may apply depending on your location and payment provider.",
        "Discount codes and early-access offers can change the price shown at checkout; quote list prices only.",
      ],
    },
    access: {
      notes: [
        "Tool pages require an account with a plan or individual tool access.",
        "Limited education access is available on application at /education-access.",
      ],
    },
    tools: TOOLS.map((t) => ({
      id: t.id,
      name: t.name,
      url: SITE_URL + t.path,
      summary: t.summary,
      includedInPlans: Object.entries(PLAN_TOOLS)
        .filter(([plan, tools]) => !plan.startsWith("tool_") && tools.includes(t.id))
        .map(([plan]) => plan),
      individual: t.individualGbp === null ? null : { priceGbp: t.individualGbp, period: "month" as Period },
    })),
    plans: PLANS,
    updates: UPDATES,
    assets: ASSETS.map(({ path, ...a }) => ({ ...a, url: SITE_URL + path, rightsHolder: "ANDY'K GROUP" })),
  };
}

/** HMAC-SHA256 over the exact response body, so the Studio can verify origin and integrity. */
export function signFeedBody(body: string, secret: string) {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}
