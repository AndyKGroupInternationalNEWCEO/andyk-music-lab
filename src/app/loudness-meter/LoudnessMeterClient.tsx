"use client";

import { useState, useRef, useEffect, useCallback } from "react";

const PLATFORM_TARGETS = [
  { label: "Spotify", lufs: -14, color: "#525252" },
  { label: "Apple",   lufs: -16, color: "#737373" },
  { label: "YouTube", lufs: -14, color: "#525252" },
  { label: "Broadcast", lufs: -23, color: "#a3a3a3" },
];

const S = { mono: { fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#a3a3a3" } };

const MAX_FILE_BYTES = 250 * 1024 * 1024; // 250MB, consistent with the Audio Converter tool

function lufsToY(lufs: number, h: number, minL = -40, maxL = 0): number {
  return h - ((lufs - minL) / (maxL - minL)) * h;
}

function computeBlockLUFS(data: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
  const rms = Math.sqrt(sum / data.length);
  return 20 * Math.log10(rms + 1e-9) - 0.691;
}

function analyzeFileLUFS(buf: AudioBuffer): { momentary: number; shortTerm: number; integrated: number } {
  const sr = buf.sampleRate;
  const data = buf.getChannelData(0);
  const blockMs = 400, blockSamples = Math.floor(sr * blockMs / 1000);
  const shortMs = 3000, shortSamples = Math.floor(sr * shortMs / 1000);
  const blocks: number[] = [];
  for (let i = 0; i + blockSamples < data.length; i += blockSamples) {
    blocks.push(computeBlockLUFS(data.slice(i, i + blockSamples)));
  }
  const gated = blocks.filter(l => l > -70);
  const integrated = gated.length > 0 ? Math.round((gated.reduce((a,b)=>a+b,0)/gated.length)*10)/10 : -70;
  const momentary = blocks.length > 0 ? Math.round(blocks[blocks.length-1]*10)/10 : -70;
  const shortBlocks = blocks.slice(-Math.ceil(shortSamples/blockSamples));
  const shortTerm = shortBlocks.length > 0 ? Math.round((shortBlocks.reduce((a,b)=>a+b,0)/shortBlocks.length)*10)/10 : -70;
  return { momentary, shortTerm, integrated };
}

function MeterBar({ value, label }: { value: number; label: string }) {
  const clamped = Math.max(-40, Math.min(0, value));
  const pct = ((clamped + 40) / 40) * 100;
  const color = value > -9 ? "#ef4444" : value > -18 ? "#f59e0b" : "#111111";
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{ ...S.mono, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "var(--font-mono)", color: "#111111" }}>
        {value > -70 ? value.toFixed(1) : "—"}
      </div>
      <div style={{ width: 32, height: 200, background: "var(--color-grid-300)", border: "1px solid var(--color-grid-500)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${pct}%`, background: color, transition: "height 0.1s ease, background 0.1s ease" }} />
        {PLATFORM_TARGETS.map(t => {
          const y = 100 - ((t.lufs + 40) / 40) * 100;
          return <div key={t.label} style={{ position: "absolute", top: `${y}%`, left: 0, right: 0, height: 1, background: t.color, opacity: 0.6 }} />;
        })}
      </div>
      <div style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "#a3a3a3", textAlign: "center" as const }}>LUFS</div>
    </div>
  );
}

export default function LoudnessMeterClient() {
  const [isAdmin] = useState(() => { if (typeof window==="undefined") return false; try { return localStorage.getItem("andyk_lab_admin")==="true"; } catch { return false; } });

  const [mode, setMode] = useState<"mic"|"file">("file");
  const [momentary, setMomentary] = useState(-70);
  const [shortTerm, setShortTerm] = useState(-70);
  const [integrated, setIntegrated] = useState(-70);
  const [history, setHistory] = useState<number[]>([]);
  const [running, setRunning] = useState(false);
  const [fileStats, setFileStats] = useState<{momentary:number;shortTerm:number;integrated:number}|null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext|null>(null);
  const streamRef = useRef<MediaStream|null>(null);
  const processorRef = useRef<ScriptProcessorNode|null>(null);
  const integratedBlocks = useRef<number[]>([]);
  const shortTermBlocks = useRef<number[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const histCanvasRef = useRef<HTMLCanvasElement>(null);

  const stopMic = useCallback(() => {
    processorRef.current?.disconnect();
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current?.close();
    audioCtxRef.current = null; processorRef.current = null; streamRef.current = null;
    setRunning(false);
  }, []);

  const startMic = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const proc = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = proc;
      proc.onaudioprocess = e => {
        const data = e.inputBuffer.getChannelData(0);
        const l = computeBlockLUFS(data);
        setMomentary(Math.round(l * 10) / 10);
        shortTermBlocks.current = [...shortTermBlocks.current.slice(-74), l];
        integratedBlocks.current = [...integratedBlocks.current, l];
        const st = shortTermBlocks.current.reduce((a,b)=>a+b,0)/shortTermBlocks.current.length;
        setShortTerm(Math.round(st*10)/10);
        const gated = integratedBlocks.current.filter(x=>x>-70);
        if (gated.length>0) setIntegrated(Math.round((gated.reduce((a,b)=>a+b,0)/gated.length)*10)/10);
        setHistory(h => [...h.slice(-199), Math.round(l*10)/10]);
      };
      src.connect(proc); proc.connect(ctx.destination);
      setRunning(true); integratedBlocks.current = []; shortTermBlocks.current = [];
    } catch { setError("Microphone access denied. Please allow microphone access and try again."); }
  }, []);

  // Release the mic and AudioContext if the user navigates away while the meter is running.
  useEffect(() => () => stopMic(), [stopMic]);

  const handleFile = useCallback(async (f: File) => {
    setError(null);
    if (!f.type.match(/audio\//) && !f.name.match(/\.(mp3|wav|flac|ogg|aac|m4a)$/i)) {
      setError("Please upload an MP3, WAV, FLAC, OGG, AAC or M4A file.");
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      setError("File is too large (max 250MB). Please upload a smaller file.");
      return;
    }
    setLoading(true); setFileStats(null);
    let ctx: AudioContext | null = null;
    try {
      const ab = await f.arrayBuffer();
      ctx = new AudioContext();
      const buf = await ctx.decodeAudioData(ab);
      const stats = analyzeFileLUFS(buf);
      setFileStats(stats);
      setMomentary(stats.momentary); setShortTerm(stats.shortTerm); setIntegrated(stats.integrated);
    } catch {
      setError("Failed to decode audio. Please try an MP3 or WAV file.");
    } finally {
      await ctx?.close().catch(() => {});
      setLoading(false);
    }
  }, []);

  // Draw history graph
  useEffect(() => {
    const canvas = histCanvasRef.current;
    if (!canvas || history.length < 2) return;
    const ctx = canvas.getContext("2d")!;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const minL=-40, maxL=0;
    PLATFORM_TARGETS.forEach(t => {
      const y = lufsToY(t.lufs, h, minL, maxL);
      ctx.strokeStyle = t.color; ctx.lineWidth = 1; ctx.setLineDash([3,3]);
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = t.color; ctx.font = "8px monospace"; ctx.textAlign = "right";
      ctx.fillText(t.label, w-2, y-2);
    });
    const step = w/(history.length-1);
    const pts = history.map((l,i)=>({ x:i*step, y:lufsToY(Math.max(minL,l),h,minL,maxL) }));
    const grad = ctx.createLinearGradient(0,0,0,h);
    grad.addColorStop(0,"rgba(0,0,0,0.2)"); grad.addColorStop(1,"rgba(0,0,0,0)");
    ctx.beginPath(); ctx.moveTo(0,h); ctx.lineTo(pts[0].x,pts[0].y);
    for (let i=1;i<pts.length;i++) { const cpx=(pts[i-1].x+pts[i].x)/2; ctx.bezierCurveTo(cpx,pts[i-1].y,cpx,pts[i].y,pts[i].x,pts[i].y); }
    ctx.lineTo(pts[pts.length-1].x,h); ctx.closePath(); ctx.fillStyle=grad; ctx.fill();
    ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y);
    for (let i=1;i<pts.length;i++) { const cpx=(pts[i-1].x+pts[i].x)/2; ctx.bezierCurveTo(cpx,pts[i-1].y,cpx,pts[i].y,pts[i].x,pts[i].y); }
    ctx.strokeStyle="#111111"; ctx.lineWidth=2; ctx.stroke();
  }, [history]);

  return (
    <div className="tool-page-bg">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="tool-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="3" width="3" height="18" rx="1"/><rect x="7" y="8" width="3" height="13" rx="1"/><rect x="12" y="5" width="3" height="16" rx="1"/><rect x="17" y="10" width="3" height="11" rx="1"/></svg>
            </div>
            <h1 style={{ fontSize: "clamp(1.5rem,3vw,2rem)", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--color-foreground)", lineHeight: 1.1 }}>
              <span className="head-word-serif serif-accent">Loudness</span>{" "}
              <span className="head-word-bold">Meter</span>
            </h1>
            {isAdmin && <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 100, background: "#111111", color: "#ffffff", fontWeight: 700 }}>Admin ✓</span>}
          </div>
          <p style={{ fontSize: 14, color: "var(--color-muted)", lineHeight: 1.65 }}>Real-time LUFS metering from microphone or file. Momentary, short-term, and integrated LUFS with platform targets.</p>
        </div>

        {/* Mode toggle */}
        <div className="glass-card rounded-2xl p-5 mb-4">
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {(["file","mic"] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); if (running) stopMic(); setFileStats(null); setMomentary(-70); setShortTerm(-70); setIntegrated(-70); setHistory([]); }}
                style={{ flex: 1, padding: "9px", borderRadius: 10, border: `1px solid ${mode===m?"#111111":"var(--color-grid-500)"}`, background: mode===m?"#111111":"transparent", color: mode===m?"#ffffff":"var(--color-muted)", fontSize: 13, fontWeight: 600, cursor: "pointer", textTransform: "capitalize" }}>
                {m === "file" ? "File Mode" : "Microphone"}
              </button>
            ))}
          </div>

          {mode === "file" ? (
            <>
              <div className="upload-zone rounded-xl p-6 flex flex-col items-center text-center cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <input ref={fileInputRef} type="file" accept="audio/*,.mp3,.wav" className="hidden"
                  onChange={e => { const f=e.target.files?.[0]; if (f) handleFile(f); }} />
                {loading ? <p style={{ color: "#111111", fontWeight: 600 }}>Analyzing…</p> :
                  <><p style={{ fontWeight: 600, color: "var(--color-foreground)" }}>Drop audio file here</p>
                  <p style={{ fontSize: 12, color: "var(--color-muted-2)" }}>MP3, WAV, FLAC</p></>}
              </div>
            </>
          ) : (
            <button onClick={running ? stopMic : startMic}
              style={{ width: "100%", padding: "12px", background: running ? "rgba(239,68,68,0.1)" : "#111111", border: running ? "1px solid rgba(239,68,68,0.3)" : "none", color: running ? "#ef4444" : "#ffffff", fontSize: 14, fontWeight: 600, cursor: "pointer", borderRadius: 10 }}>
              {running ? "■ Stop Meter" : "▶ Start Microphone Meter"}
            </button>
          )}
          {error && <p style={{ marginTop: 12, fontSize: 12, color: "#ef4444" }}>{error}</p>}
        </div>

        {/* Meters */}
        <div className="glass-card rounded-2xl p-6 mb-4">
          <div style={{ ...S.mono, marginBottom: 20 }}>LUFS Readings</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 24 }}>
            <MeterBar value={momentary}  label="Momentary" />
            <MeterBar value={shortTerm}  label="Short-term" />
            <MeterBar value={integrated} label="Integrated" />
          </div>
          {/* Platform targets legend */}
          <div style={{ display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
            {PLATFORM_TARGETS.map(t => (
              <div key={t.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 16, height: 2, background: t.color }} />
                <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "#a3a3a3" }}>{t.label} {t.lufs}</span>
              </div>
            ))}
          </div>
        </div>

        {/* History graph (mic mode) */}
        {mode === "mic" && history.length > 1 && (
          <div className="glass-card rounded-2xl p-5">
            <div style={{ ...S.mono, marginBottom: 10 }}>Loudness History</div>
            <canvas ref={histCanvasRef} width={600} height={100} style={{ width: "100%", height: 100, display: "block" }} />
          </div>
        )}
      </div>
    </div>
  );
}
