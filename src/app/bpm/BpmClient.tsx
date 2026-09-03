"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import HowItWorks from "@/components/HowItWorks";

const BPM_STEPS = [
  { text: "Your audio is loaded into an AudioBuffer via the Web Audio API." },
  { text: "BPM is detected using onset energy autocorrelation — the algorithm finds the dominant rhythmic period." },
  { text: "Key is detected using the Krumhansl-Schmuckler chroma correlation algorithm." },
  { text: "Camelot code is mapped from the detected key using the Camelot Wheel standard." },
  { text: "Danceability is calculated from a weighted combination of BPM proximity to 128 and overall energy." },
  { text: "Song Pitch is estimated via autocorrelation in the 80–1800 Hz range." },
  { text: "All processing runs 100% in your browser — your file is never uploaded.", warning: true },
];

// ── Music theory constants ─────────────────────────────────────────────────
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const CAMELOT: Record<string, string> = {
  "C major": "8B", "G major": "9B", "D major": "10B", "A major": "11B",
  "E major": "12B", "B major": "1B", "F# major": "2B", "C# major": "3B",
  "G# major": "4B", "D# major": "5B", "A# major": "6B", "F major": "7B",
  "A minor": "8A", "E minor": "9A", "B minor": "10A", "F# minor": "11A",
  "C# minor": "12A", "G# minor": "1A", "D# minor": "2A", "A# minor": "3A",
  "F minor": "4A", "C minor": "5A", "G minor": "6A", "D minor": "7A",
};

// ── Audio analysis ─────────────────────────────────────────────────────────
function correlate(chroma: number[], profile: number[]): number {
  const n = 12;
  const meanC = chroma.reduce((a, b) => a + b, 0) / n;
  const meanP = profile.reduce((a, b) => a + b, 0) / n;
  let num = 0, dc = 0, dp = 0;
  for (let i = 0; i < n; i++) {
    const cc = chroma[i] - meanC, pp = profile[i] - meanP;
    num += cc * pp; dc += cc * cc; dp += pp * pp;
  }
  return num / (Math.sqrt(dc) * Math.sqrt(dp) + 1e-9);
}

function buildChroma(buffer: AudioBuffer): number[] {
  const sampleRate = buffer.sampleRate;
  const data = buffer.getChannelData(0);
  const fftSize = 4096;
  const chroma = new Array(12).fill(0);
  const step = Math.floor(data.length / 20);
  for (let start = 0; start + fftSize < data.length; start += step) {
    const window = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++)
      window[i] = data[start + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (fftSize - 1)));
    for (let bin = 1; bin < fftSize / 2; bin++) {
      const freq = (bin * sampleRate) / fftSize;
      if (freq < 55 || freq > 4000) continue;
      let re = 0, im = 0;
      for (let i = 0; i < fftSize; i++) {
        const angle = (2 * Math.PI * bin * i) / fftSize;
        re += window[i] * Math.cos(angle);
        im -= window[i] * Math.sin(angle);
      }
      const mag = Math.sqrt(re * re + im * im);
      const midi = Math.round(12 * Math.log2(freq / 440) + 69);
      if (midi >= 0) chroma[((midi % 12) + 12) % 12] += mag;
    }
  }
  return chroma;
}

function detectKey(chroma: number[]): { note: string; mode: "major" | "minor" } {
  let bestCorr = -Infinity, bestNote = 0, bestMode: "major" | "minor" = "major";
  for (let shift = 0; shift < 12; shift++) {
    const rotated = [...chroma.slice(shift), ...chroma.slice(0, shift)];
    const maj = correlate(rotated, MAJOR_PROFILE);
    const min = correlate(rotated, MINOR_PROFILE);
    if (maj > bestCorr) { bestCorr = maj; bestNote = shift; bestMode = "major"; }
    if (min > bestCorr) { bestCorr = min; bestNote = shift; bestMode = "minor"; }
  }
  return { note: NOTE_NAMES[bestNote], mode: bestMode };
}

async function detectBPM(buffer: AudioBuffer, admin = false): Promise<number> {
  const sampleRate = buffer.sampleRate;
  const data = buffer.getChannelData(0);
  const frameSize = 512, hopSize = 256;
  const frames: number[] = [];
  const limit = admin ? data.length : Math.min(data.length, sampleRate * 90);
  for (let i = 0; i + frameSize < limit; i += hopSize) {
    let energy = 0;
    for (let j = 0; j < frameSize; j++) energy += data[i + j] * data[i + j];
    frames.push(energy / frameSize);
  }
  const maxE = Math.max(...frames);
  const normalized = frames.map(e => e / (maxE + 1e-9));
  const minLag = Math.round((60 * sampleRate) / (180 * hopSize));
  const maxLag = Math.round((60 * sampleRate) / (40 * hopSize));
  let bestCorr = -Infinity, bestLag = minLag;
  for (let lag = minLag; lag <= maxLag && lag < frames.length / 2; lag++) {
    let corr = 0;
    const n = frames.length - lag;
    for (let i = 0; i < n; i++) corr += normalized[i] * normalized[i + lag];
    corr /= n;
    if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
  }
  let b = (60 * sampleRate) / (bestLag * hopSize);
  while (b > 175) b /= 2;
  while (b < 80) b *= 2;
  return Math.round(b);
}

function detectPitch(buffer: AudioBuffer): number {
  const data = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const windowSize = 2048;
  const mid = Math.floor(data.length / 2);
  const minP = Math.floor(sampleRate / 1800);
  const maxP = Math.floor(sampleRate / 80);
  let bestCorr = -1, bestP = maxP;
  for (let p = minP; p <= maxP; p++) {
    let corr = 0;
    for (let i = 0; i < windowSize - p; i++) corr += data[mid + i] * data[mid + i + p];
    if (corr > bestCorr) { bestCorr = corr; bestP = p; }
  }
  return Math.round(sampleRate / bestP);
}

function computeEnergy(buffer: AudioBuffer): number {
  const data = buffer.getChannelData(0);
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
  const rms = Math.sqrt(sum / data.length);
  const db = 20 * Math.log10(rms + 1e-9);
  return Math.round(Math.max(0, Math.min(100, ((db + 40) / 40) * 100)));
}

function calcDanceability(bpm: number, energy: number): number {
  const bpmScore = Math.max(0, 100 - Math.abs(bpm - 128) * 1.5);
  return Math.round(0.45 * bpmScore + 0.55 * energy);
}

function formatBytes(b: number) {
  return b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`;
}

// ── Camelot wheel helpers ─────────────────────────────────────────────────
function camelotNeighbors(key: string): string[] {
  const m = key.match(/^(\d+)(A|B)$/);
  if (!m) return [key];
  const num = parseInt(m[1]), mode = m[2], oMode = mode === "A" ? "B" : "A";
  const prev = ((num - 2 + 12) % 12) + 1, next = (num % 12) + 1;
  return [key, `${prev}${mode}`, `${next}${mode}`, `${num}${oMode}`];
}

function camelotHue(n: number): string {
  const hue = ((n - 1) / 12) * 360;
  return `hsl(${hue}, 65%, 42%)`;
}

function camelotHueLight(n: number): string {
  const hue = ((n - 1) / 12) * 360;
  return `hsl(${hue}, 60%, 88%)`;
}

// ── Camelot Wheel SVG ─────────────────────────────────────────────────────
function arcPath(cx: number, cy: number, r1: number, r2: number, a1: number, a2: number): string {
  const cos = Math.cos, sin = Math.sin;
  const x1o = cx + r2 * cos(a1), y1o = cy + r2 * sin(a1);
  const x2o = cx + r2 * cos(a2), y2o = cy + r2 * sin(a2);
  const x1i = cx + r1 * cos(a2), y1i = cy + r1 * sin(a2);
  const x2i = cx + r1 * cos(a1), y2i = cy + r1 * sin(a1);
  const large = a2 - a1 > Math.PI ? 1 : 0;
  return `M ${x1o} ${y1o} A ${r2} ${r2} 0 ${large} 1 ${x2o} ${y2o} L ${x1i} ${y1i} A ${r1} ${r1} 0 ${large} 0 ${x2i} ${y2i} Z`;
}

interface WheelProps {
  detected: string;
  selected: string;
  onSelect: (key: string) => void;
  bpm: number | null;
}

function CamelotWheel({ detected, selected, onSelect, bpm }: WheelProps) {
  const cx = 155, cy = 155, outerR = 145, midR = 108, innerR = 72, gap = 0.025;
  const compatible = selected ? camelotNeighbors(selected) : (detected ? camelotNeighbors(detected) : []);

  return (
    <svg width="310" height="310" viewBox="0 0 310 310" className="camelot-wheel-svg" style={{ maxWidth: "min(100%, 300px)", height: "auto" }}>
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur"/>
          <feComposite in="SourceGraphic" in2="blur" operator="over"/>
        </filter>
      </defs>

      {/* Background circle */}
      <circle cx={cx} cy={cy} r={outerR} fill="rgba(0,0,0,0.06)" />

      {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => {
        const a1 = ((n - 1) / 12) * 2 * Math.PI - Math.PI / 2 + gap;
        const a2 = (n / 12) * 2 * Math.PI - Math.PI / 2 - gap;
        const mid = (a1 + a2) / 2;
        const aKey = `${n}A`, bKey = `${n}B`;
        const color = camelotHue(n);
        const colorLight = camelotHueLight(n);

        const bActive = bKey === detected || compatible.includes(bKey);
        const aActive = aKey === detected || compatible.includes(aKey);
        const bDetected = bKey === detected;
        const aDetected = aKey === detected;

        const bxText = cx + ((outerR + midR) / 2) * Math.cos(mid);
        const byText = cy + ((outerR + midR) / 2) * Math.sin(mid);
        const axText = cx + ((midR + innerR) / 2) * Math.cos(mid);
        const ayText = cy + ((midR + innerR) / 2) * Math.sin(mid);

        return (
          <g key={n}>
            {/* Outer B ring */}
            <path
              d={arcPath(cx, cy, midR + 2, outerR - 2, a1, a2)}
              fill={bActive ? color : "rgba(150,150,150,0.12)"}
              style={{ filter: bDetected ? "drop-shadow(0 0 6px rgba(0,0,0,0.9))" : "none", cursor: "pointer", opacity: bActive ? 1 : 0.35 }}
              onClick={() => onSelect(bKey)}
              stroke={bDetected ? "#D9D9D9" : "transparent"}
              strokeWidth={bDetected ? "2" : "0"}
            />
            <text x={bxText} y={byText} textAnchor="middle" dominantBaseline="central"
              fontSize="10" fontWeight="700" fill={bActive ? "white" : "#888"}
              style={{ pointerEvents: "none", userSelect: "none", fontFamily: "var(--font-mono)" }}>
              {bKey}
            </text>

            {/* Inner A ring */}
            <path
              d={arcPath(cx, cy, innerR + 2, midR - 2, a1, a2)}
              fill={aActive ? colorLight : "rgba(150,150,150,0.08)"}
              style={{ filter: aDetected ? "drop-shadow(0 0 5px rgba(0,0,0,0.8))" : "none", cursor: "pointer", opacity: aActive ? 1 : 0.35 }}
              onClick={() => onSelect(aKey)}
              stroke={aDetected ? "#D9D9D9" : "transparent"}
              strokeWidth={aDetected ? "2" : "0"}
            />
            <text x={axText} y={ayText} textAnchor="middle" dominantBaseline="central"
              fontSize="9" fontWeight="600" fill={aActive ? "#111111" : "#aaa"}
              style={{ pointerEvents: "none", userSelect: "none", fontFamily: "var(--font-mono)" }}>
              {aKey}
            </text>
          </g>
        );
      })}

      {/* Center display */}
      <circle cx={cx} cy={cy} r={innerR - 4} fill="var(--color-bg-light)" stroke="var(--color-grid-500)" strokeWidth="1" />
      {bpm !== null ? (
        <>
          <text x={cx} y={cy - 8} textAnchor="middle" fontSize="24" fontWeight="800" fill="#111111" fontFamily="var(--font-mono)">{bpm}</text>
          <text x={cx} y={cy + 12} textAnchor="middle" fontSize="10" fill="var(--color-muted-2)" fontFamily="var(--font-mono)">BPM</text>
        </>
      ) : (
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize="11" fill="var(--color-muted-2)" fontFamily="var(--font-mono)">Camelot</text>
      )}

      {/* Separator ring */}
      <circle cx={cx} cy={cy} r={midR} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="3" />
    </svg>
  );
}

// ── History ───────────────────────────────────────────────────────────────
interface HistoryEntry {
  name: string; bpm: number; key: string; mode: string;
  camelot: string; energy: number; danceability: number; pitch: number; timestamp: number;
}
interface Result { bpm: number; key: string; mode: "major"|"minor"; camelot: string; energy: number; danceability: number; pitch: number; }

function loadHistory(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem("andyk-bpm-history") || "[]"); } catch { return []; }
}
function saveHistory(entry: HistoryEntry) {
  const h = loadHistory();
  localStorage.setItem("andyk-bpm-history", JSON.stringify([entry, ...h].slice(0, 10)));
}

// ── Tap BPM ───────────────────────────────────────────────────────────────
function TapBPM() {
  const [taps, setTaps] = useState<number[]>([]);
  const [tappedBPM, setTappedBPM] = useState<number | null>(null);

  const tap = () => {
    const now = Date.now();
    setTaps(prev => {
      const recent = [...prev.filter(t => now - t < 5000), now];
      if (recent.length >= 2) {
        const avg = (recent[recent.length - 1] - recent[0]) / (recent.length - 1);
        setTappedBPM(Math.round(60000 / avg));
      }
      return recent;
    });
  };

  const reset = () => { setTaps([]); setTappedBPM(null); };

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={tap}
        className={`tap-bpm-btn ${taps.length > 0 ? "tapping" : ""}`}
      >
        <span style={{ fontSize: 14, fontWeight: 800 }}>TAP</span>
        {tappedBPM !== null && <span style={{ fontSize: 22, fontWeight: 900, fontFamily: "var(--font-mono)" }}>{tappedBPM}</span>}
        {tappedBPM === null && taps.length > 0 && <span style={{ fontSize: 11, fontFamily: "var(--font-mono)" }}>×{taps.length}</span>}
      </button>
      {taps.length > 0 && (
        <button onClick={reset} style={{ fontSize: 11, color: "var(--color-muted-2)", textDecoration: "underline", cursor: "pointer", background: "none", border: "none" }}>
          reset
        </button>
      )}
      <p style={{ fontSize: 11, color: "var(--color-muted-2)", textAlign: "center" }}>Tap to the beat</p>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function BpmClient() {
  const [isAdmin] = useState(() => {
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem("andyk_lab_admin") === "true"; } catch { return false; }
  });


  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedKey, setSelectedKey] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scanRef = useRef<HTMLCanvasElement>(null);
  const scanAnim = useRef<number>(0);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  // Scanning animation
  useEffect(() => {
    if (!analyzing) { cancelAnimationFrame(scanAnim.current); return; }
    const canvas = scanRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const w = canvas.width, h = canvas.height;
    let x = 0;
    const bars = Array.from({ length: 60 }, () => Math.random() * 0.7 + 0.1);

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const bw = w / bars.length;
      bars.forEach((v, i) => {
        const bh = v * h * 0.8;
        const played = i < (x / w) * bars.length;
        ctx.fillStyle = played ? "#111111" : "rgba(0,0,0,0.25)";
        ctx.beginPath();
        ctx.roundRect(i * bw + 1, (h - bh) / 2, bw - 2, bh, 2);
        ctx.fill();
      });
      // scan line
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(x - 1, 0, 2, h);
      x = (x + 1.5) % w;
      if (Math.random() > 0.97) {
        const idx = Math.floor(Math.random() * bars.length);
        bars[idx] = Math.random() * 0.7 + 0.1;
      }
      scanAnim.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(scanAnim.current);
  }, [analyzing]);

  const analyzeFile = useCallback(async (f: File) => {
    setAnalyzing(true); setError(null);
    try {
      const ab = await f.arrayBuffer();
      const audioCtx = new AudioContext();
      const buffer = await audioCtx.decodeAudioData(ab);
      await audioCtx.close();
      const [bpm, chroma, energy, pitch] = await Promise.all([
        detectBPM(buffer, isAdmin),
        Promise.resolve(buildChroma(buffer)),
        Promise.resolve(computeEnergy(buffer)),
        Promise.resolve(detectPitch(buffer)),
      ]);
      const { note, mode } = detectKey(chroma);
      const keyLabel = `${note} ${mode}`;
      const camelot = CAMELOT[keyLabel] ?? "—";
      const danceability = calcDanceability(bpm, energy);
      const r: Result = { bpm, key: note, mode, camelot, energy, danceability, pitch };
      setResult(r); setSelectedKey(camelot);
      const entry: HistoryEntry = { name: f.name.replace(/\.[^.]+$/, ""), bpm, key: note, mode, camelot, energy, danceability, pitch, timestamp: Date.now() };
      saveHistory(entry); setHistory(loadHistory());
    } catch (err) {
      console.error(err); setError("Analysis failed. Please try a different file.");
    } finally { setAnalyzing(false); }
  }, [isAdmin]);

  const handleFile = useCallback((f: File) => {
    if (!f.type.match(/audio\/(mpeg|wav|mp3|x-wav|ogg|aac|flac)/) && !f.name.match(/\.(mp3|wav|ogg|flac|aac)$/i)) {
      setError("Please upload an MP3 or WAV file."); return;
    }
    if (f.size > 250 * 1024 * 1024) {
      setError("File is too large (max 250MB). Please upload a smaller file."); return;
    }
    setFile(f); setResult(null); setError(null); setSelectedKey("");
    analyzeFile(f);
  }, [analyzeFile]);

  const copyExport = () => {
    if (!result || !file) return;
    const text = [
      file.name.replace(/\.[^.]+$/, ""),
      `BPM: ${result.bpm} | Key: ${result.key} ${result.mode} | Camelot: ${result.camelot}`,
      `Energy: ${result.energy} | Danceability: ${result.danceability} | Pitch: ${result.pitch} Hz`,
      `Compatible keys: ${camelotNeighbors(result.camelot).join(", ")}`,
    ].join("\n");
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const energyLabel = (e: number) => e >= 70 ? "High" : e >= 40 ? "Medium" : "Low";
  const energyColor = (e: number) => e >= 70 ? "#ef4444" : e >= 40 ? "#111111" : "#60a5fa";
  const danceColor = (d: number) => d >= 70 ? "#111111" : d >= 45 ? "#f59e0b" : "#ef4444";

  const wheelDetected = result?.camelot ?? "";
  const wheelSelected = selectedKey;

  return (
    <div className="tool-page-bg">
      <div className="max-w-5xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="tool-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="2,12 5,12 7,5 9,19 11,9 13,15 15,11 17,13 19,12 22,12"/>
              </svg>
            </div>
            <h1 style={{ fontSize: "clamp(1.5rem,3vw,2rem)", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--color-foreground)", lineHeight: 1.1 }}>
              <span className="head-word-serif serif-accent">BPM</span>{" "}
              <span className="head-word-bold">+</span>{" "}
              <span className="head-word-serif serif-accent">Key</span>{" "}
              <span className="head-word-bold">Detector</span>
            </h1>
            <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 100, background: isAdmin ? "#111111" : "var(--color-soft-green)", color: isAdmin ? "#ffffff" : "var(--color-deep-teal)", fontWeight: 700, flexShrink: 0 }}>{isAdmin ? "Admin ✓" : "Free"}</span>
          </div>
          <p style={{ fontSize: 14, color: "var(--color-muted)", lineHeight: 1.65, maxWidth: 520 }}>
            Upload an MP3 or WAV. Detect BPM, key, Camelot position, danceability, and pitch — entirely in your browser.
          </p>
        </div>

        <div className="grid lg:grid-cols-[1fr_320px] gap-8">
          {/* ── Left column ── */}
          <div className="flex flex-col gap-6">

            {/* Upload zone */}
            <div
              className={`upload-zone rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer ${dragOver ? "drag-over" : ""}`}
              style={{ minHeight: 160 }}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              onClick={() => !file && inputRef.current?.click()}
            >
              <input ref={inputRef} type="file" accept="audio/mpeg,audio/wav,.mp3,.wav,.flac,.ogg" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              {file ? (
                <div className="w-full">
                  <div className="flex items-center justify-between">
                    <span style={{ fontWeight: 600, color: "var(--color-foreground)", fontSize: 14 }} className="truncate max-w-xs">{file.name}</span>
                    <button onClick={e => { e.stopPropagation(); setFile(null); setResult(null); setError(null); }}
                      style={{ fontSize: 12, color: "var(--color-muted-2)", marginLeft: 12, background: "none", border: "none", cursor: "pointer" }}>✕ Remove</button>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-muted-2)", marginTop: 4 }}>{formatBytes(file.size)}</div>
                </div>
              ) : (
                <>
                  <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--color-soft-green)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-deep-teal)" strokeWidth="2" strokeLinecap="round"><polyline points="2,12 5,12 7,5 9,19 11,9 13,15 15,11 17,13 19,12 22,12"/></svg>
                  </div>
                  <p style={{ fontWeight: 600, color: "var(--color-foreground)", marginBottom: 4 }}>Drop your MP3 or WAV here</p>
                  <p style={{ fontSize: 13, color: "var(--color-muted-2)" }}>or click to browse</p>
                </>
              )}
            </div>

            {/* How it works */}
            {!file && (
              <HowItWorks
                title="How BPM & Key Detection Works"
                steps={BPM_STEPS}
                privacyNote="Processing happens 100% in your browser. Your audio file is never uploaded to any server."
              />
            )}

            {/* Waveform animation during analysis */}
            {(analyzing || file) && (
              <div className="waveform-player">
                <canvas ref={scanRef} width={600} height={80} style={{ width: "100%", height: 80, display: "block" }} />
              </div>
            )}

            {error && (
              <div style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", fontSize: 13, color: "#ef4444" }}>
                {error}
              </div>
            )}

            {/* Auto-analysis progress */}
            {analyzing && (
              <div style={{ width: "100%", padding: "16px", borderRadius: 14, background: "rgba(0,0,0,0.08)", border: "1px solid rgba(0,0,0,0.2)", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid #111111", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
                <span style={{ fontWeight: 600, color: "#111111", fontSize: 14 }}>Analyzing track…</span>
                <div style={{ flex: 1, height: 4, borderRadius: 2, background: "var(--color-grid-500)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: "60%", background: "#111111", borderRadius: 2, animation: "progress-pulse 1.2s ease-in-out infinite" }} />
                </div>
              </div>
            )}
            {file && !analyzing && !result && (
              <button onClick={() => analyzeFile(file)} className="btn-primary" style={{ width: "100%", justifyContent: "center", padding: "14px" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="2,12 5,12 7,5 9,19 11,9 13,15 15,11 17,13 19,12 22,12"/></svg>
                Re-analyze Track
              </button>
            )}

            {/* Results */}
            {result && (
              <div className="glass-card rounded-2xl p-6 animate-fade-up">
                {/* Main metrics */}
                <div className="grid grid-cols-3 gap-6 text-center mb-5">
                  <div>
                    <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-muted-2)", marginBottom: 6 }}>BPM</div>
                    <div style={{ fontSize: 52, fontWeight: 900, fontFamily: "var(--font-mono)", color: "#111111", lineHeight: 1 }}>{result.bpm}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-muted-2)", marginBottom: 6 }}>Key</div>
                    <div style={{ fontSize: 36, fontWeight: 800, fontFamily: "var(--font-mono)", color: "var(--color-foreground)", lineHeight: 1 }}>{result.key}</div>
                    <div style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 4, textTransform: "capitalize" }}>{result.mode}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-muted-2)", marginBottom: 6 }}>Camelot</div>
                    <div style={{ display: "inline-block" }}>
                      <span className={`font-mono font-bold px-3 py-1 rounded-lg ${result.camelot.endsWith("B") ? "camelot-B" : "camelot-A"}`}
                        style={{ fontSize: 28 }}>
                        {result.camelot}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="tron-line" style={{ margin: "0 0 16px" }} />

                {/* Secondary metrics */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div style={{ padding: "10px 14px", borderRadius: 12, background: "var(--color-grid-300)", border: "1px solid var(--color-grid-500)" }}>
                    <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-muted-2)", marginBottom: 4 }}>Danceability</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 22, fontWeight: 800, fontFamily: "var(--font-mono)", color: danceColor(result.danceability) }}>{result.danceability}</span>
                      <div style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--color-grid-500)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${result.danceability}%`, background: danceColor(result.danceability), borderRadius: 3 }} />
                      </div>
                    </div>
                  </div>
                  <div style={{ padding: "10px 14px", borderRadius: 12, background: "var(--color-grid-300)", border: "1px solid var(--color-grid-500)" }}>
                    <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-muted-2)", marginBottom: 4 }}>Energy</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 22, fontWeight: 800, fontFamily: "var(--font-mono)", color: energyColor(result.energy) }}>{result.energy}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ height: 6, borderRadius: 3, background: "var(--color-grid-500)", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${result.energy}%`, background: energyColor(result.energy), borderRadius: 3 }} />
                        </div>
                        <div style={{ fontSize: 10, color: energyColor(result.energy), marginTop: 2, fontFamily: "var(--font-mono)" }}>{energyLabel(result.energy)}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                  <span className="stat-pill">
                    <span style={{ fontFamily: "var(--font-mono)", color: "#111111" }}>♪</span>
                    Pitch: {result.pitch} Hz
                  </span>
                  <span className="stat-pill">
                    Compatible: {camelotNeighbors(result.camelot).join(" · ")}
                  </span>
                </div>

                <button onClick={copyExport}
                  style={{ width: "100%", padding: "10px", borderRadius: 10, border: "1px solid var(--color-grid-500)", background: copied ? "rgba(0,0,0,0.12)" : "transparent", color: copied ? "#111111" : "var(--color-muted)", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.2s ease" }}>
                  {copied ? "✓ Copied to clipboard" : "Copy Report"}
                </button>
              </div>
            )}

            {/* Tap BPM */}
            <div className="glass-card rounded-2xl p-6">
              <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-muted-2)", marginBottom: 14 }}>Tap BPM</div>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <TapBPM />
              </div>
            </div>
          </div>

          {/* ── Right column: Camelot Wheel ── */}
          <div className="flex flex-col gap-6">
            <div className="glass-card rounded-2xl p-5">
              <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-muted-2)", marginBottom: 10 }}>Camelot Wheel</div>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <CamelotWheel
                  detected={wheelDetected}
                  selected={wheelSelected}
                  onSelect={k => setSelectedKey(prev => prev === k ? "" : k)}
                  bpm={result?.bpm ?? null}
                />
              </div>
              {wheelSelected && (
                <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, background: "var(--color-grid-300)", border: "1px solid var(--color-grid-500)", fontSize: 12 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--color-foreground)" }}>{wheelSelected}</span>
                  <span style={{ color: "var(--color-muted-2)" }}> compatible with: </span>
                  <span style={{ fontFamily: "var(--font-mono)", color: "#111111" }}>{camelotNeighbors(wheelSelected).join(", ")}</span>
                </div>
              )}
              <p style={{ fontSize: 11, color: "var(--color-muted-2)", marginTop: 10, textAlign: "center", lineHeight: 1.5 }}>
                B = major · A = minor<br/>Click to highlight compatible keys
              </p>
            </div>

            {/* Method pills */}
            <div className="glass-card rounded-2xl p-5">
              <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-muted-2)", marginBottom: 12 }}>Detection Methods</div>
              <div className="flex flex-col gap-3">
                {[
                  ["BPM", "Onset autocorrelation"],
                  ["Key", "Krumhansl-Schmuckler"],
                  ["Pitch", "Autocorrelation 80–1800 Hz"],
                  ["Camelot", "Harmonic mixing wheel"],
                ].map(([val, label]) => (
                  <div key={val} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12, color: "var(--color-foreground)" }}>{val}</span>
                    <span style={{ fontSize: 11, color: "var(--color-muted-2)" }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── History ── */}
        {history.length > 0 && (
          <div style={{ marginTop: 40 }}>
            <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-muted-2)", marginBottom: 12 }}>
              Recent Tracks ({history.length})
            </div>
            <div className="flex flex-col gap-2">
              {history.map((h, i) => (
                <div key={i} className="history-item" style={{ cursor: "pointer" }}
                  onClick={() => {
                    setResult({ bpm: h.bpm, key: h.key, mode: h.mode as "major"|"minor", camelot: h.camelot, energy: h.energy, danceability: h.danceability, pitch: h.pitch });
                    setSelectedKey(h.camelot);
                  }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--color-foreground)" }}>{h.name}</div>
                    <div style={{ fontSize: 11, color: "var(--color-muted-2)" }}>{new Date(h.timestamp).toLocaleDateString()}</div>
                  </div>
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "#111111", fontSize: 14 }}>{h.bpm} BPM</span>
                  <span className={`font-mono font-bold text-sm px-2 py-0.5 rounded ${h.camelot.endsWith("B") ? "camelot-B" : "camelot-A"}`}>{h.camelot}</span>
                  <span style={{ fontSize: 11, color: "var(--color-muted-2)", fontFamily: "var(--font-mono)" }}>{energyLabel(h.energy)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes progress-pulse{0%,100%{opacity:0.4}50%{opacity:1}}`}</style>
    </div>
  );
}
