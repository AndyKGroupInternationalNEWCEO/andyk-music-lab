"use client";

import { useState, useRef, useCallback } from "react";
import HowItWorks from "@/components/HowItWorks";

const STEPS = [
  { text: "Upload two audio files — each is decoded locally via the Web Audio API." },
  { text: "LUFS, peak dBFS, and dynamic range are computed from the raw PCM samples." },
  { text: "BPM is detected via onset autocorrelation (40–180 BPM range)." },
  { text: "Musical key is identified using the Krumhansl-Schmuckler chroma algorithm." },
  { text: "Results are compared side-by-side with visual difference bars." },
  { text: "Your audio never leaves your browser.", warning: true },
];

const MAJOR_PROFILE = [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
const MINOR_PROFILE = [6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];
const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const CAMELOT: Record<string,string> = {
  "C major":"8B","G major":"9B","D major":"10B","A major":"11B","E major":"12B","B major":"1B",
  "F# major":"2B","C# major":"3B","G# major":"4B","D# major":"5B","A# major":"6B","F major":"7B",
  "A minor":"8A","E minor":"9A","B minor":"10A","F# minor":"11A","C# minor":"12A","G# minor":"1A",
  "D# minor":"2A","A# minor":"3A","F minor":"4A","C minor":"5A","G minor":"6A","D minor":"7A",
};

interface Stats { lufs: number; peak: number; dr: number; bpm: number; key: string; mode: "major"|"minor"; camelot: string; duration: number; }

function computeStats(buf: AudioBuffer): { lufs: number; peak: number; dr: number } {
  const L = buf.getChannelData(0);
  const R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
  let sumSq = 0, peak = 0;
  const blockSize = Math.floor(buf.sampleRate * 0.4);
  const blocks: number[] = [];
  for (let i = 0; i < L.length; i++) { const s = (Math.abs(L[i])+Math.abs(R[i]))/2; if (s>peak) peak=s; sumSq+=s*s; }
  for (let b = 0; b+blockSize < L.length; b += blockSize) { let bSq=0; for (let i=0;i<blockSize;i++) bSq+=((L[b+i]+R[b+i])/2)**2; blocks.push(bSq/blockSize); }
  blocks.sort((a,b)=>b-a);
  const loudRms = Math.sqrt(blocks[0]||1e-10), quietRms = Math.sqrt(blocks[Math.floor(blocks.length*0.3)]||1e-10);
  const dr = Math.max(0, Math.round(20*Math.log10(loudRms/(quietRms+1e-9))));
  const lufs = Math.round((20*Math.log10(Math.sqrt(sumSq/L.length)+1e-9)-0.691)*10)/10;
  const peakDb = Math.round(20*Math.log10(peak+1e-9)*10)/10;
  return { lufs, peak: peakDb, dr };
}

function detectBPM(buf: AudioBuffer): number {
  const sr = buf.sampleRate, data = buf.getChannelData(0);
  const frameSize=512, hopSize=256, frames: number[]=[];
  const limit = Math.min(data.length, sr*90);
  for (let i=0;i+frameSize<limit;i+=hopSize) { let e=0; for (let j=0;j<frameSize;j++) e+=data[i+j]*data[i+j]; frames.push(e/frameSize); }
  const maxE = Math.max(...frames);
  const norm = frames.map(e=>e/(maxE+1e-9));
  const minLag=Math.round(60*sr/(180*hopSize)), maxLag=Math.round(60*sr/(40*hopSize));
  let bestC=-Infinity, bestLag=minLag;
  for (let lag=minLag;lag<=maxLag&&lag<frames.length/2;lag++) { let c=0; const n=frames.length-lag; for (let i=0;i<n;i++) c+=norm[i]*norm[i+lag]; c/=n; if (c>bestC) { bestC=c; bestLag=lag; } }
  let b=(60*sr)/(bestLag*hopSize); while (b>175) b/=2; while (b<80) b*=2; return Math.round(b);
}

function detectKey(buf: AudioBuffer): { note: string; mode: "major"|"minor" } {
  const sr=buf.sampleRate, data=buf.getChannelData(0);
  const fftSize=4096, chroma=new Array(12).fill(0), step=Math.floor(data.length/20);
  for (let s=0;s+fftSize<data.length;s+=step) {
    const win=new Float32Array(fftSize);
    for (let i=0;i<fftSize;i++) win[i]=data[s+i]*(0.5-0.5*Math.cos(2*Math.PI*i/(fftSize-1)));
    for (let bin=1;bin<fftSize/2;bin++) {
      const freq=(bin*sr)/fftSize; if (freq<55||freq>4000) continue;
      let re=0,im=0; for (let i=0;i<fftSize;i++) { const a=2*Math.PI*bin*i/fftSize; re+=win[i]*Math.cos(a); im-=win[i]*Math.sin(a); }
      const mag=Math.sqrt(re*re+im*im), midi=Math.round(12*Math.log2(freq/440)+69);
      if (midi>=0) chroma[((midi%12)+12)%12]+=mag;
    }
  }
  const corr=(c: number[], p: number[]) => { const mC=c.reduce((a,b)=>a+b,0)/12,mP=p.reduce((a,b)=>a+b,0)/12; let num=0,dc=0,dp=0; for (let i=0;i<12;i++){const cc=c[i]-mC,pp=p[i]-mP;num+=cc*pp;dc+=cc*cc;dp+=pp*pp;} return num/(Math.sqrt(dc)*Math.sqrt(dp)+1e-9); };
  let best=-Infinity, note=0, mode: "major"|"minor"="major";
  for (let sh=0;sh<12;sh++) { const rot=[...chroma.slice(sh),...chroma.slice(0,sh)]; const maj=corr(rot,MAJOR_PROFILE),min=corr(rot,MINOR_PROFILE); if (maj>best){best=maj;note=sh;mode="major";} if (min>best){best=min;note=sh;mode="minor";} }
  return { note: NOTE_NAMES[note], mode };
}

async function analyzeFile(file: File): Promise<Stats> {
  const ab = await file.arrayBuffer();
  const audioCtx = new AudioContext();
  const buf = await audioCtx.decodeAudioData(ab);
  await audioCtx.close();
  const base = computeStats(buf);
  const bpm = detectBPM(buf);
  const { note, mode } = detectKey(buf);
  const camelot = CAMELOT[`${note} ${mode}`] ?? "—";
  return { ...base, bpm, key: note, mode, camelot, duration: buf.duration };
}

function fmt(s: number) { return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`; }

const ROWS: { label: string; key: keyof Stats; unit?: string; higherBetter?: boolean }[] = [
  { label: "LUFS",          key: "lufs",     unit: "",    higherBetter: false },
  { label: "Peak dBFS",     key: "peak",     unit: "",    higherBetter: false },
  { label: "Dynamic Range", key: "dr",       unit: " dB", higherBetter: true  },
  { label: "BPM",           key: "bpm",      unit: "",    higherBetter: undefined },
  { label: "Key",           key: "key",      higherBetter: undefined },
  { label: "Mode",          key: "mode",     higherBetter: undefined },
  { label: "Camelot",       key: "camelot",  higherBetter: undefined },
  { label: "Duration",      key: "duration", higherBetter: undefined },
];

const S = { label: { fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#a3a3a3" } };

export default function TrackComparatorClient() {
  const [isAdmin] = useState(() => { if (typeof window==="undefined") return false; try { return localStorage.getItem("andyk_lab_admin")==="true"; } catch { return false; } });

  const [fileA, setFileA] = useState<File|null>(null);
  const [fileB, setFileB] = useState<File|null>(null);
  const [statsA, setStatsA] = useState<Stats|null>(null);
  const [statsB, setStatsB] = useState<Stats|null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const refA = useRef<HTMLInputElement>(null);
  const refB = useRef<HTMLInputElement>(null);

  const pickFile = (label: "A" | "B", f: File) => {
    if (!f.type.match(/audio\//) && !f.name.match(/\.(mp3|wav|flac|ogg|aac|m4a)$/i)) {
      setError("Please upload an MP3, WAV, FLAC, OGG, AAC or M4A file."); return;
    }
    if (f.size > 250 * 1024 * 1024) {
      setError("File is too large (max 250MB). Please upload a smaller file."); return;
    }
    setError(null);
    if (label === "A") setFileA(f); else setFileB(f);
    setStatsA(null); setStatsB(null);
  };

  const compare = useCallback(async () => {
    if (!fileA || !fileB) return;
    setLoading(true); setError(null);
    try {
      const [a, b] = await Promise.all([analyzeFile(fileA), analyzeFile(fileB)]);
      setStatsA(a); setStatsB(b);
    } catch { setError("Failed to analyze one or both files."); }
    finally { setLoading(false); }
  }, [fileA, fileB]);

  const getVerdict = (a: Stats, b: Stats): string[] => {
    const lines: string[] = [];
    if (a.lufs > b.lufs) lines.push(`Track A is ${Math.abs(a.lufs-b.lufs).toFixed(1)} dB louder integrated.`);
    else if (b.lufs > a.lufs) lines.push(`Track B is ${Math.abs(a.lufs-b.lufs).toFixed(1)} dB louder integrated.`);
    else lines.push("Both tracks have equal integrated loudness.");
    if (a.dr > b.dr) lines.push(`Track A has more dynamic range (+${a.dr-b.dr} dB DR).`);
    else if (b.dr > a.dr) lines.push(`Track B has more dynamic range (+${b.dr-a.dr} dB DR).`);
    if (a.camelot===b.camelot) lines.push("Both tracks share the same Camelot key — harmonic mix.");
    return lines;
  };

  const renderVal = (s: Stats, key: keyof Stats) => {
    if (key==="duration") return fmt(s.duration as number);
    return String(s[key]);
  };

  const renderBar = (a: Stats, b: Stats, key: keyof Stats, higherBetter?: boolean) => {
    if (typeof a[key]!=="number"||typeof b[key]!=="number") return null;
    const va=a[key] as number, vb=b[key] as number;
    if (va===vb) return null;
    const aWins = higherBetter===undefined ? null : (higherBetter ? va>vb : va<vb);
    const diff = Math.abs(va-vb).toFixed(1);
    return (
      <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", marginTop: 3, color: aWins===true ? "#111111" : aWins===false ? "#737373" : "#a3a3a3" }}>
        Δ {diff}
      </div>
    );
  };

  return (
    <div className="tool-page-bg">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="tool-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="3" width="9" height="18" rx="1"/><rect x="13" y="3" width="9" height="18" rx="1"/></svg>
            </div>
            <h1 style={{ fontSize: "clamp(1.5rem,3vw,2rem)", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--color-foreground)", lineHeight: 1.1 }}>
              <span className="head-word-serif serif-accent">Track</span>{" "}
              <span className="head-word-bold">Comparator</span>
            </h1>
            {isAdmin && <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 100, background: "#111111", color: "#ffffff", fontWeight: 700 }}>Admin ✓</span>}
          </div>
          <p style={{ fontSize: 14, color: "var(--color-muted)", lineHeight: 1.65, maxWidth: 520 }}>Upload two tracks. Compare loudness, dynamics, BPM, key, and Camelot side-by-side — entirely in your browser.</p>
        </div>

        {!statsA && !statsB && <HowItWorks title="How Track Comparator Works" steps={STEPS} privacyNote="Your audio never leaves your browser." />}

        {/* Upload pair */}
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          {(["A","B"] as const).map(label => {
            const file = label==="A" ? fileA : fileB;
            const ref = label==="A" ? refA : refB;
            return (
              <div key={label}
                className={`upload-zone rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer`}
                style={{ minHeight: 140 }}
                onClick={() => ref.current?.click()}>
                <input ref={ref} type="file" accept="audio/*,.mp3,.wav" className="hidden"
                  onChange={e => { const f=e.target.files?.[0]; if (f) pickFile(label, f); }} />
                {file ? (
                  <div className="w-full text-left">
                    <div style={{ ...S.label, marginBottom: 6 }}>Track {label}</div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--color-foreground)" }} className="truncate">{file.name}</div>
                    <button onClick={e=>{ e.stopPropagation(); if (label==="A") setFileA(null); else setFileB(null); setStatsA(null);setStatsB(null); }}
                      style={{ fontSize: 11, color: "var(--color-muted-2)", marginTop: 4, background: "none", border: "none", cursor: "pointer" }}>✕ Remove</button>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 28, fontFamily: "var(--font-mono)", fontWeight: 800, color: "#e5e5e5", marginBottom: 8 }}>{label}</div>
                    <p style={{ fontSize: 13, color: "var(--color-muted-2)" }}>Drop Track {label} here</p>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {error && <div style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", fontSize: 13, color: "#ef4444", marginBottom: 12 }}>{error}</div>}

        {fileA && fileB && !statsA && (
          <button onClick={compare} disabled={loading} className="btn-primary" style={{ width: "100%", justifyContent: "center", padding: "14px", marginBottom: 24 }}>
            {loading ? "Analyzing both tracks…" : "Compare Tracks"}
          </button>
        )}

        {statsA && statsB && (
          <div className="animate-fade-up">
            {/* Verdict */}
            <div className="glass-card rounded-2xl p-5 mb-4">
              <div style={{ ...S.label, marginBottom: 12 }}>Verdict</div>
              {getVerdict(statsA, statsB).map((v,i) => (
                <p key={i} style={{ fontSize: 14, color: "var(--color-foreground)", lineHeight: 1.7, margin: 0 }}>→ {v}</p>
              ))}
            </div>

            {/* Comparison table */}
            <div className="glass-card rounded-2xl overflow-hidden">
              {/* Header */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", padding: "10px 20px", background: "var(--color-grid-300)", borderBottom: "1px solid var(--color-grid-500)" }}>
                <span style={S.label}>Metric</span>
                <span style={{ ...S.label, textAlign: "right" as const }}>Track A</span>
                <span style={{ ...S.label, textAlign: "center" as const }}>Δ</span>
                <span style={{ ...S.label, textAlign: "right" as const }}>Track B</span>
              </div>
              {/* Track names */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", padding: "8px 20px", borderBottom: "1px solid var(--color-grid-500)", background: "#fafafa" }}>
                <span style={{ fontSize: 10, color: "#a3a3a3", fontFamily: "var(--font-mono)" }}>File</span>
                <span style={{ fontSize: 11, color: "var(--color-foreground)", fontWeight: 600, textAlign: "right" as const }} className="truncate">{fileA?.name.replace(/\.[^.]+$/,"")}</span>
                <span />
                <span style={{ fontSize: 11, color: "var(--color-foreground)", fontWeight: 600, textAlign: "right" as const }} className="truncate">{fileB?.name.replace(/\.[^.]+$/,"")}</span>
              </div>
              {ROWS.map((row, i) => (
                <div key={row.key} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", padding: "12px 20px", borderBottom: i<ROWS.length-1 ? "1px solid var(--color-grid-500)" : "none", alignItems: "center" }}>
                  <span style={S.label}>{row.label}</span>
                  <div style={{ textAlign: "right" as const }}>
                    <span style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-mono)", color: "#111111" }}>{renderVal(statsA, row.key)}</span>
                    {row.unit && <span style={{ fontSize: 11, color: "#a3a3a3" }}>{row.unit}</span>}
                  </div>
                  <div style={{ textAlign: "center" as const }}>
                    {renderBar(statsA, statsB, row.key, row.higherBetter)}
                  </div>
                  <div style={{ textAlign: "right" as const }}>
                    <span style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-mono)", color: "#111111" }}>{renderVal(statsB, row.key)}</span>
                    {row.unit && <span style={{ fontSize: 11, color: "#a3a3a3" }}>{row.unit}</span>}
                  </div>
                </div>
              ))}
            </div>

            <button onClick={()=>{setStatsA(null);setStatsB(null);setFileA(null);setFileB(null);}} style={{ marginTop: 16, fontSize: 12, color: "var(--color-muted-2)", background: "none", border: "none", cursor: "pointer" }}>
              ← Compare different tracks
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
