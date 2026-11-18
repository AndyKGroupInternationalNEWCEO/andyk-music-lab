import type { MetadataRoute } from "next";

const BASE = "https://lab.djandykofficial.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE,                              lastModified: new Date(), changeFrequency: "weekly",  priority: 1.0 },
    { url: `${BASE}/mastering`,               lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/bpm`,                     lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/planner`,                 lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/track-comparator`,        lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/chord-generator`,         lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/metronome`,               lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/loudness-meter`,          lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/stem-splitter`,           lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/news/10-djs-10-opportunities`, lastModified: new Date("2026-11-18"), changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/education-access`,         lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/pricing-terms`,            lastModified: new Date(), changeFrequency: "yearly",  priority: 0.5 },
    { url: `${BASE}/privacy-policy`,          lastModified: new Date(), changeFrequency: "yearly",  priority: 0.3 },
    { url: `${BASE}/cookies-policy`,          lastModified: new Date(), changeFrequency: "yearly",  priority: 0.3 },
    { url: `${BASE}/terms-and-conditions`,    lastModified: new Date(), changeFrequency: "yearly",  priority: 0.3 },
    { url: `${BASE}/disclaimer`,              lastModified: new Date(), changeFrequency: "yearly",  priority: 0.3 },
    { url: `${BASE}/company-information`,     lastModified: new Date(), changeFrequency: "yearly",  priority: 0.3 },
    { url: `${BASE}/copyright`,               lastModified: new Date(), changeFrequency: "yearly",  priority: 0.3 },
  ];
}
