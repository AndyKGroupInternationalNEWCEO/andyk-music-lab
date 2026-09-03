"use client";

import { useState, useRef, useEffect } from "react";
import HowItWorks from "@/components/HowItWorks";

const PLANNER_STEPS = [
  { text: "Add your tracks with BPM, Camelot key, and duration." },
  { text: "The Camelot Wheel algorithm calculates harmonic compatibility between every pair of tracks." },
  { text: "Perfect: same key — identical Camelot position (e.g. 8B → 8B)." },
  { text: "Good: ±1 step on the wheel or same number switching mode (e.g. 8B → 9B or 8B → 8A)." },
  { text: "Risky: 2 steps away on the Camelot Wheel — noticeable but manageable clash." },
  { text: "Avoid: incompatible keys — more than 2 steps apart on the wheel." },
  { text: "Energy Flow: a canvas visualisation of tempo across the set." },
  { text: "Export your set as Rekordbox XML — ready to import into Pioneer DJ software." },
  { text: "No data is sent to any server. Everything stays in your browser.", warning: true },
];

// ── Camelot logic ──────────────────────────────────────────────────────────
const CAMELOT_KEYS = [
  "1A","2A","3A","4A","5A","6A","7A","8A","9A","10A","11A","12A",
  "1B","2B","3B","4B","5B","6B","7B","8B","9B","10B","11B","12B",
];

function camelotNum(key: string): number {
  const m = key.match(/^(\d+)(A|B)$/);
  return m ? parseInt(m[1]) : 0;
}

function camelotNeighbors(key: string): string[] {
  const m = key.match(/^(\d+)(A|B)$/);
  if (!m) return [key];
  const num = parseInt(m[1]), mode = m[2], oMode = mode === "A" ? "B" : "A";
  const prev = ((num - 2 + 12) % 12) + 1, next = (num % 12) + 1;
  return [key, `${prev}${mode}`, `${next}${mode}`, `${num}${oMode}`];
}

function compatibility(a: string, b: string): "perfect" | "good" | "risky" | "avoid" {
  if (!a || !b) return "avoid";
  if (a === b) return "perfect";
  const neighbors = camelotNeighbors(a);
  if (neighbors.includes(b)) return "good";
  const ma = a.match(/^(\d+)(A|B)$/), mb = b.match(/^(\d+)(A|B)$/);
  if (ma && mb && ma[2] === mb[2]) {
    const diff = Math.abs(parseInt(ma[1]) - parseInt(mb[1]));
    const wrap = Math.min(diff, 12 - diff);
    if (wrap === 2) return "risky";
  }
  return "avoid";
}

const COMPAT_COLORS: Record<string, { bg: string; text: string; label: string; dot: string }> = {
  perfect: { bg: "rgba(0,0,0,0.12)", text: "#111111", label: "Perfect", dot: "#111111" },
  good:    { bg: "rgba(59,130,246,0.1)",  text: "#1d4ed8", label: "Good",    dot: "#3b82f6" },
  risky:   { bg: "rgba(245,158,11,0.1)",  text: "#92400e", label: "Risky",   dot: "#f59e0b" },
  avoid:   { bg: "rgba(239,68,68,0.1)",   text: "#991b1b", label: "Avoid",   dot: "#ef4444" },
};

function camelotHSL(key: string): string {
  const n = camelotNum(key);
  if (!n) return "hsl(210,12%,55%)";
  const hue = ((n - 1) / 12) * 360;
  const mode = key.endsWith("A") ? "A" : "B";
  return mode === "B"
    ? `hsl(${hue}, 65%, 42%)`
    : `hsl(${hue}, 50%, 62%)`;
}

function buildHarmonicOrder(tracks: Track[]): Track[] {
  if (tracks.length <= 1) return [...tracks];
  const remaining = [...tracks];
  const ordered: Track[] = [remaining.splice(0, 1)[0]];
  while (remaining.length > 0) {
    const last = ordered[ordered.length - 1];
    let bestIdx = 0, bestScore = -1;
    for (let i = 0; i < remaining.length; i++) {
      const c = compatibility(last.camelot, remaining[i].camelot);
      const score = c === "perfect" ? 4 : c === "good" ? 3 : c === "risky" ? 2 : 1;
      if (score > bestScore) { bestScore = score; bestIdx = i; }
    }
    ordered.push(remaining.splice(bestIdx, 1)[0]);
  }
  return ordered;
}

// ── Types ──────────────────────────────────────────────────────────────────
interface Track { id: string; title: string; bpm: string; camelot: string; duration: string; }

let _id = 0;
const uid = () => String(++_id);
const emptyTrack = (): Track => ({ id: uid(), title: "", bpm: "", camelot: "", duration: "5:00" });

function parseDuration(s: string): number {
  const m = s.match(/^(\d+):(\d{2})$/);
  if (m) return parseInt(m[1]) * 60 + parseInt(m[2]);
  const mins = parseFloat(s);
  return isNaN(mins) ? 300 : mins * 60;
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60), s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ── Energy flow canvas ─────────────────────────────────────────────────────
function EnergyCanvas({ tracks }: { tracks: Track[] }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || tracks.length === 0) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = 120 * dpr;
    ctx.scale(dpr, dpr);
    const w = rect.width, h = 120;
    ctx.clearRect(0, 0, w, h);

    const bw = w / tracks.length;
    const pts: { x: number; y: number }[] = [];

    tracks.forEach((t, i) => {
      const bpm = parseFloat(t.bpm) || 120;
      const energy = Math.max(0, Math.min(1, (bpm - 60) / 140));
      const barH = energy * (h - 24) + 12;
      const x = i * bw, y = h - barH;
      const color = camelotHSL(t.camelot);
      ctx.fillStyle = color + "88";
      ctx.beginPath();
      (ctx as CanvasRenderingContext2D & { roundRect(x: number, y: number, w: number, h: number, r: number): void }).roundRect(x + 4, y, bw - 8, barH, 4);
      ctx.fill();
      pts.push({ x: x + bw / 2, y });
    });

    if (pts.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = "#111111";
      ctx.lineWidth = 2;
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        const cpx = (pts[i - 1].x + pts[i].x) / 2;
        ctx.bezierCurveTo(cpx, pts[i - 1].y, cpx, pts[i].y, pts[i].x, pts[i].y);
      }
      ctx.stroke();
      pts.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#111111";
        ctx.fill();
      });
    }

    // BPM labels
    tracks.forEach((t, i) => {
      if (!t.bpm) return;
      const x = i * bw + bw / 2;
      ctx.fillStyle = "rgba(139,147,168,0.9)";
      ctx.font = `9px var(--font-mono, monospace)`;
      ctx.textAlign = "center";
      ctx.fillText(t.bpm, x, h - 3);
    });
  }, [tracks]);

  return (
    <div className="energy-canvas-wrap" style={{ width: "100%" }}>
      <canvas ref={ref} style={{ display: "block", width: "100%", height: 120 }} />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function PlannerClient() {
  const [isAdmin] = useState(() => {
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem("andyk_lab_admin") === "true"; } catch { return false; }
  });


  const [tracks, setTracks] = useState<Track[]>([emptyTrack(), emptyTrack(), emptyTrack()]);
  const [playlist, setPlaylist] = useState<Track[] | null>(null);
  const [minBPM, setMinBPM] = useState(0);
  const [maxBPM, setMaxBPM] = useState(200);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [showRef, setShowRef] = useState(false);

  const update = (id: string, field: keyof Track, value: string) => {
    setTracks(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
    setPlaylist(null);
  };
  const addTrack = () => { setTracks(prev => [...prev, emptyTrack()]); setPlaylist(null); };
  const removeTrack = (id: string) => { setTracks(prev => prev.filter(t => t.id !== id)); setPlaylist(null); };

  // Drag & drop
  const onDragStart = (i: number) => setDragIndex(i);
  const onDragOver = (e: React.DragEvent, i: number) => { e.preventDefault(); setDropIndex(i); };
  const onDrop = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === i) { setDragIndex(null); setDropIndex(null); return; }
    setTracks(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(dragIndex, 1);
      arr.splice(i, 0, moved);
      return arr;
    });
    setDragIndex(null); setDropIndex(null); setPlaylist(null);
  };
  const onDragEnd = () => { setDragIndex(null); setDropIndex(null); };

  const buildPlaylist = () => {
    const valid = tracks.filter(t => t.title.trim() && t.camelot.trim());
    if (valid.length < 2) return;
    setPlaylist(buildHarmonicOrder(valid));
  };

  const autoSort = () => {
    const valid = tracks.filter(t => t.title.trim() && t.camelot.trim());
    if (valid.length < 2) return;
    setTracks(buildHarmonicOrder(tracks));
    setPlaylist(null);
  };

  const exportText = () => {
    if (!playlist) return;
    const lines = ["DJ Set Playlist — Andy'K Planner", "=".repeat(36), ""];
    playlist.forEach((t, i) => {
      const next = playlist[i + 1];
      const compat = next ? compatibility(t.camelot, next.camelot) : null;
      lines.push(`${i + 1}. ${t.title}  [${t.bpm ? t.bpm + " BPM" : ""}  ${t.camelot}]`);
      if (compat) lines.push(`   → ${COMPAT_COLORS[compat].label} transition to ${next.title}`);
    });
    lines.push("", `Total: ${playlist.length} tracks | Generated by andyk-music-lab.vercel.app`);
    navigator.clipboard.writeText(lines.join("\n")).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const exportRekordbox = () => {
    if (!playlist) return;
    const entries = playlist.map((t, i) =>
      `    <TRACK TrackID="${i + 1}" Name="${t.title.replace(/"/g, "&quot;")}" BPM="${t.bpm || "0"}" Tonality="${t.camelot}" />`
    ).join("\n");
    const keys = playlist.map((_, i) => `        <TRACK Key="${i + 1}"/>`).join("\n");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<DJ_PLAYLISTS Version="1.0.0">\n  <PRODUCT Name="andyk-music-lab" Version="2.0" Company="ANDY'K GROUP INTERNATIONAL"/>\n  <COLLECTION Entries="${playlist.length}">\n${entries}\n  </COLLECTION>\n  <PLAYLISTS>\n    <NODE Type="0" Name="ROOT">\n      <NODE Type="1" Name="Andy'K Set" Entries="${playlist.length}">\n${keys}\n      </NODE>\n    </NODE>\n  </PLAYLISTS>\n</DJ_PLAYLISTS>`;
    const blob = new Blob([xml], { type: "text/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "andyk-set.xml"; a.click();
    URL.revokeObjectURL(url);
  };

  const xmlInputRef = useRef<HTMLInputElement>(null);

  const importRekordbox = (f: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      const xml = e.target?.result as string;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, "text/xml");
      const trackEls = Array.from(doc.querySelectorAll("TRACK"));
      if (trackEls.length === 0) return;
      const imported: Track[] = trackEls.slice(0, 50).map(el => ({
        id: uid(),
        title: el.getAttribute("Name") || "",
        bpm: el.getAttribute("BPM") || "",
        camelot: el.getAttribute("Tonality") || "",
        duration: "5:00",
      })).filter(t => t.title);
      if (imported.length > 0) { setTracks(imported); setPlaylist(null); }
    };
    reader.readAsText(f);
  };

  const validCount = tracks.filter(t => t.title.trim() && t.camelot.trim()).length;
  const inBPMRange = (t: Track) => {
    if (!t.bpm) return true;
    const b = parseFloat(t.bpm);
    return b >= minBPM && b <= maxBPM;
  };

  const totalDuration = playlist ? playlist.reduce((sum, t) => sum + parseDuration(t.duration), 0) : 0;

  const compatCounts = playlist ? (() => {
    const c = { perfect: 0, good: 0, risky: 0, avoid: 0 };
    playlist.slice(0, -1).forEach((t, i) => { c[compatibility(t.camelot, playlist[i + 1].camelot)]++; });
    return c;
  })() : null;

  return (
    <div className="tool-page-bg">
      <div className="max-w-4xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="tool-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none"/></svg>
            </div>
            <h1 style={{ fontSize: "clamp(1.5rem,3vw,2rem)", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--color-foreground)", lineHeight: 1.1 }}>
              <span className="head-word-serif serif-accent">DJ</span>{" "}
              <span className="head-word-bold">Set</span>{" "}
              <span className="head-word-serif serif-accent">Planner</span>
            </h1>
            <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 100, background: isAdmin ? "#111111" : "var(--color-soft-green)", color: isAdmin ? "#ffffff" : "var(--color-deep-teal)", fontWeight: 700, flexShrink: 0 }}>{isAdmin ? "Admin ✓" : "Free"}</span>
          </div>
          <p style={{ fontSize: 14, color: "var(--color-muted)", lineHeight: 1.65, maxWidth: 520 }}>
            Add your tracks with Camelot keys, drag to reorder, auto-sort harmonically, and export for Rekordbox.
          </p>
        </div>

        {/* How it works */}
        <HowItWorks
          title="How DJ Set Planner Works"
          steps={PLANNER_STEPS}
          privacyNote="No data is sent to any server. The planner runs entirely in your browser."
        />

        {/* BPM filter */}
        <div className="glass-card rounded-2xl p-5 mb-4">
          <div className="flex items-center gap-6 flex-wrap">
            <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-muted-2)", flexShrink: 0 }}>BPM Filter</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 200 }}>
              <input type="number" value={minBPM} min={0} max={maxBPM} onChange={e => setMinBPM(+e.target.value)}
                style={{ width: 64, padding: "6px 8px", borderRadius: 8, border: "1px solid var(--color-grid-500)", background: "var(--color-grid-300)", color: "var(--color-foreground)", fontFamily: "var(--font-mono)", fontSize: 13, outline: "none" }} />
              <div style={{ flex: 1, height: 4, borderRadius: 2, background: "var(--color-grid-500)", position: "relative" }}>
                <div style={{ position: "absolute", left: `${(minBPM / 200) * 100}%`, right: `${100 - (maxBPM / 200) * 100}%`, top: 0, bottom: 0, background: "#111111", borderRadius: 2 }} />
              </div>
              <input type="number" value={maxBPM} min={minBPM} max={200} onChange={e => setMaxBPM(+e.target.value)}
                style={{ width: 64, padding: "6px 8px", borderRadius: 8, border: "1px solid var(--color-grid-500)", background: "var(--color-grid-300)", color: "var(--color-foreground)", fontFamily: "var(--font-mono)", fontSize: 13, outline: "none" }} />
            </div>
            <button onClick={autoSort} disabled={validCount < 2}
              style={{ padding: "8px 16px", borderRadius: 10, background: validCount >= 2 ? "var(--color-deep-teal)" : "var(--color-grid-500)", color: "white", fontSize: 13, fontWeight: 600, cursor: validCount >= 2 ? "pointer" : "not-allowed", border: "none", transition: "all 0.2s ease", flexShrink: 0 }}>
              Auto-Sort
            </button>
          </div>
        </div>

        {/* Rekordbox import */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <input ref={xmlInputRef} type="file" accept=".xml,text/xml" className="hidden"
            onChange={e => { const f=e.target.files?.[0]; if (f) importRekordbox(f); }} />
          <button onClick={() => xmlInputRef.current?.click()}
            style={{ padding: "7px 14px", borderRadius: 9, border: "1px solid var(--color-grid-500)", background: "transparent", color: "var(--color-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Import Rekordbox XML
          </button>
        </div>

        {/* Track table */}
        <div className="glass-card rounded-2xl p-5 mb-4">
          <div className="planner-track-header">
            <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-muted-2)" }}>Track Title</span>
            <div className="planner-row-fields">
              {["BPM", "Camelot", "Duration"].map(h => (
                <span key={h} style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-muted-2)" }}>{h}</span>
              ))}
            </div>
            <span />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {tracks.map((track, i) => {
              const dimmed = !inBPMRange(track) && !!track.bpm;
              const isDragging = dragIndex === i;
              const isDropTarget = dropIndex === i && dragIndex !== i;
              return (
                <div key={track.id}
                  className="track-card-draggable planner-track-row"
                  draggable
                  onDragStart={() => onDragStart(i)}
                  onDragOver={e => onDragOver(e, i)}
                  onDrop={e => onDrop(e, i)}
                  onDragEnd={onDragEnd}
                  style={{
                    opacity: isDragging ? 0.4 : dimmed ? 0.45 : 1,
                    border: `1px solid ${isDropTarget ? "#111111" : "transparent"}`,
                    background: isDropTarget ? "rgba(0,0,0,0.06)" : "transparent",
                  }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 3, height: 24, borderRadius: 2, background: track.camelot ? camelotHSL(track.camelot) : "var(--color-grid-500)", flexShrink: 0 }} />
                    <input type="text" placeholder="Track name…" value={track.title} onChange={e => update(track.id, "title", e.target.value)}
                      style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid var(--color-grid-500)", background: "var(--color-grid-300)", color: "var(--color-foreground)", fontSize: 13, outline: "none", transition: "border-color 0.15s ease" }}
                      onFocus={e => (e.target.style.borderColor = "#111111")}
                      onBlur={e => (e.target.style.borderColor = "var(--color-grid-500)")} />
                  </div>
                  <div className="planner-row-fields">
                    <input type="number" placeholder="128" value={track.bpm} onChange={e => update(track.id, "bpm", e.target.value)}
                      style={{ width: 80, padding: "7px 10px", borderRadius: 8, border: "1px solid var(--color-grid-500)", background: "var(--color-grid-300)", color: "var(--color-foreground)", fontSize: 13, fontFamily: "var(--font-mono)", outline: "none" }}
                      onFocus={e => (e.target.style.borderColor = "#111111")} onBlur={e => (e.target.style.borderColor = "var(--color-grid-500)")} />
                    <select value={track.camelot} onChange={e => update(track.id, "camelot", e.target.value)}
                      style={{ width: 90, padding: "7px 8px", borderRadius: 8, border: "1px solid var(--color-grid-500)", background: "var(--color-grid-300)", color: "var(--color-foreground)", fontSize: 13, fontFamily: "var(--font-mono)", outline: "none" }}>
                      <option value="">—</option>
                      {CAMELOT_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                    <input type="text" placeholder="5:00" value={track.duration} onChange={e => update(track.id, "duration", e.target.value)}
                      style={{ width: 80, padding: "7px 8px", borderRadius: 8, border: "1px solid var(--color-grid-500)", background: "var(--color-grid-300)", color: "var(--color-foreground)", fontSize: 13, fontFamily: "var(--font-mono)", outline: "none" }}
                      onFocus={e => (e.target.style.borderColor = "#111111")} onBlur={e => (e.target.style.borderColor = "var(--color-grid-500)")} />
                  </div>
                  <button onClick={() => removeTrack(track.id)}
                    style={{ width: 36, height: 36, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "1px solid var(--color-grid-500)", color: "var(--color-muted-2)", cursor: "pointer", fontSize: 18, transition: "all 0.15s ease" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#ef4444"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(239,68,68,0.35)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--color-muted-2)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--color-grid-500)"; }}>
                    ×
                  </button>
                </div>
              );
            })}
          </div>

          <button onClick={addTrack}
            style={{ marginTop: 12, fontSize: 13, color: "#111111", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            + Add track
          </button>
        </div>

        {/* Build button */}
        <button onClick={buildPlaylist} disabled={validCount < 2}
          style={{ width: "100%", padding: "14px", borderRadius: 14, background: validCount >= 2 ? "linear-gradient(135deg, #111111, #333333)" : "var(--color-grid-500)", color: "white", fontWeight: 600, fontSize: 15, cursor: validCount >= 2 ? "pointer" : "not-allowed", border: "none", boxShadow: validCount >= 2 ? "0 4px 20px rgba(0,0,0,0.3)" : "none", transition: "all 0.25s ease", marginBottom: 32 }}>
          {validCount < 2 ? `Add at least 2 tracks with Camelot keys` : "Build Harmonic Playlist"}
        </button>

        {/* Playlist result */}
        {playlist && (
          <div className="animate-fade-up">
            {/* Header + export */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
              <h2 style={{ fontWeight: 700, color: "var(--color-foreground)", fontSize: 16 }}>
                Harmonic Playlist — {playlist.length} tracks · {formatTime(totalDuration)}
              </h2>
              <div className="planner-export-btns" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={exportText}
                  style={{ padding: "8px 14px", borderRadius: 9, border: "1px solid var(--color-grid-500)", background: copied ? "rgba(0,0,0,0.1)" : "transparent", color: copied ? "#111111" : "var(--color-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s ease" }}>
                  {copied ? "✓ Copied" : "Copy Text"}
                </button>
                <button onClick={exportRekordbox}
                  style={{ padding: "8px 14px", borderRadius: 9, border: "1px solid rgba(0,0,0,0.3)", background: "rgba(0,0,0,0.08)", color: "var(--color-deep-teal)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  Export Rekordbox XML
                </button>
              </div>
            </div>

            {/* Tracks */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 24 }}>
              {playlist.map((track, i) => {
                const next = playlist[i + 1];
                const compat = next ? compatibility(track.camelot, next.camelot) : null;
                const keyColor = camelotHSL(track.camelot);
                return (
                  <div key={track.id}>
                    <div className="glass-card" style={{ borderRadius: 14, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, borderLeft: `3px solid ${keyColor}` }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--color-muted-2)", width: 24, textAlign: "right", flexShrink: 0 }}>{i + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: "var(--color-foreground)", fontSize: 14 }} className="truncate">{track.title}</div>
                        <div style={{ fontSize: 11, color: "var(--color-muted-2)", marginTop: 2, fontFamily: "var(--font-mono)" }}>
                          {track.bpm && `${track.bpm} BPM`}
                          {track.bpm && track.duration && " · "}
                          {track.duration}
                        </div>
                      </div>
                      <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 13, padding: "4px 10px", borderRadius: 8, background: keyColor + "22", color: keyColor, border: `1px solid ${keyColor}44`, flexShrink: 0 }}>
                        {track.camelot}
                      </span>
                    </div>
                    {compat && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 16px" }}>
                        <div style={{ width: 1, height: 12, background: "var(--color-grid-500)" }} />
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: COMPAT_COLORS[compat].dot }} />
                        <span style={{ fontSize: 11, fontWeight: 600, color: COMPAT_COLORS[compat].text, padding: "2px 8px", borderRadius: 100, background: COMPAT_COLORS[compat].bg }}>
                          {COMPAT_COLORS[compat].label} transition
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Stats */}
            {compatCounts && (
              <div className="compat-stats-grid grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                {(["perfect", "good", "risky", "avoid"] as const).map(c => (
                  <div key={c} style={{ padding: "12px", borderRadius: 14, background: COMPAT_COLORS[c].bg, border: `1px solid ${COMPAT_COLORS[c].dot}33`, textAlign: "center" }}>
                    <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "var(--font-mono)", color: COMPAT_COLORS[c].text }}>{compatCounts[c]}</div>
                    <div style={{ fontSize: 11, color: COMPAT_COLORS[c].text, marginTop: 2, fontWeight: 600 }}>{COMPAT_COLORS[c].label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Energy flow */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-muted-2)", marginBottom: 10 }}>Energy Flow</div>
              <EnergyCanvas tracks={playlist} />
            </div>

            {/* Set timeline */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-muted-2)", marginBottom: 10 }}>Set Timeline</div>
              <div className="set-timeline" style={{ display: "flex", overflowX: "auto", gap: 0 }}>
                {playlist.map((t, i) => {
                  const cumulative = playlist.slice(0, i).reduce((s, x) => s + parseDuration(x.duration), 0);
                  const keyColor = camelotHSL(t.camelot);
                  return (
                    <div key={t.id} className="timeline-track" style={{ minWidth: 120, paddingRight: 12 }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-muted-2)", marginBottom: 4 }}>{formatTime(cumulative)}</div>
                      <div style={{ height: 4, borderRadius: 2, background: keyColor, marginBottom: 6, opacity: 0.7 }} />
                      <div style={{ fontSize: 11, color: "var(--color-foreground)", lineHeight: 1.3 }} className="truncate">{t.title}</div>
                      <div style={{ fontSize: 10, color: "var(--color-muted-2)", fontFamily: "var(--font-mono)", marginTop: 2 }}>{t.camelot} · {t.duration}</div>
                    </div>
                  );
                })}
                <div style={{ paddingLeft: 12, flexShrink: 0 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-muted-2)", marginBottom: 4 }}>{formatTime(totalDuration)}</div>
                  <div style={{ height: 4, borderRadius: 2, background: "var(--color-grid-500)", marginBottom: 6 }} />
                  <div style={{ fontSize: 11, color: "var(--color-muted)", fontWeight: 600 }}>End</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Camelot reference */}
        <div style={{ marginTop: 16 }}>
          <button onClick={() => setShowRef(r => !r)}
            style={{ fontSize: 12, color: "var(--color-muted-2)", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, marginBottom: 10 }}>
            {showRef ? "▾" : "▸"} Camelot quick reference
          </button>
          {showRef && (
            <div className="glass-card rounded-2xl p-5">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 4 }}>
                {CAMELOT_KEYS.map(k => (
                  <span key={k} className={`text-xs font-mono font-bold px-2 py-1 rounded text-center ${k.endsWith("B") ? "camelot-B" : "camelot-A"}`}>{k}</span>
                ))}
              </div>
              <p style={{ fontSize: 11, color: "var(--color-muted-2)", marginTop: 10 }}>
                A = minor · B = major · Mix ±1 same mode or same number for Perfect/Good transitions.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
