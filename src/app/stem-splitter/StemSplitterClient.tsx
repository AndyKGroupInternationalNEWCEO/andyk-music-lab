"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import HowItWorks from "@/components/HowItWorks";

const STEPS = [
  { text: "Your audio file is decoded locally via the Web Audio API." },
  { text: "Bass stem: low-pass filter below 200 Hz captures sub-bass and kick body." },
  { text: "Mids stem: band-pass 200 Hz – 4 kHz captures vocals, synths, and instruments." },
  { text: "Highs stem: high-pass filter above 4 kHz captures cymbals, air, and brightness." },
  { text: "Each stem is rendered to a separate AudioBuffer and encoded as 16-bit WAV." },
  { text: "Browser approximation — not full source separation. Results will contain bleed between stems.", warning: true },
  { text: "Your audio never leaves your browser.", warning: true },
];

interface StemResult { name: string; url: string; buffer: AudioBuffer; color: string; }

function encodeWAV(buf: AudioBuffer): ArrayBuffer {
  const numCh=buf.numberOfChannels, sr=buf.sampleRate, numSamples=buf.length;
  const bitsPerSample=16, bytesPerSample=2, blockAlign=numCh*bytesPerSample, byteRate=sr*blockAlign, dataBytes=numSamples*blockAlign;
  const ab=new ArrayBuffer(44+dataBytes); const view=new DataView(ab);
  const write=(o:number,s:string)=>{for(let i=0;i<s.length;i++)view.setUint8(o+i,s.charCodeAt(i));};
  write(0,"RIFF"); view.setUint32(4,36+dataBytes,true); write(8,"WAVE"); write(12,"fmt ");
  view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,numCh,true);
  view.setUint32(24,sr,true); view.setUint32(28,byteRate,true); view.setUint16(32,blockAlign,true);
  view.setUint16(34,bitsPerSample,true); write(36,"data"); view.setUint32(40,dataBytes,true);
  let offset=44;
  const channels=Array.from({length:numCh},(_,c)=>buf.getChannelData(c));
  for(let i=0;i<numSamples;i++) for(let c=0;c<numCh;c++) {
    const s=Math.max(-1,Math.min(1,channels[c][i]));
    view.setInt16(offset,s<0?s*32768:s*32767,true); offset+=2;
  }
  return ab;
}

async function renderStem(src: AudioBuffer, type: "bass"|"mids"|"highs"): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(src.numberOfChannels, src.length, src.sampleRate);
  const source = ctx.createBufferSource();
  source.buffer = src;
  let node: AudioNode = source;

  if (type === "bass") {
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 200; lp.Q.value = 0.7;
    node.connect(lp); node = lp;
  } else if (type === "mids") {
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 200; hp.Q.value = 0.7;
    node.connect(hp); node = hp;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 4000; lp.Q.value = 0.7;
    node.connect(lp); node = lp;
  } else {
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 4000; hp.Q.value = 0.7;
    node.connect(hp); node = hp;
  }
  node.connect(ctx.destination);
  source.start(0);
  return ctx.startRendering();
}

function drawWaveform(canvas: HTMLCanvasElement, buf: AudioBuffer, color: string) {
  const ctx = canvas.getContext("2d")!;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const w = rect.width, h = rect.height;
  ctx.clearRect(0, 0, w, h);
  const data = buf.getChannelData(0);
  const bins = Math.floor(w / 3);
  const step = Math.floor(data.length / bins);
  for (let i = 0; i < bins; i++) {
    let max = 0;
    for (let j = 0; j < step; j++) max = Math.max(max, Math.abs(data[i*step+j]||0));
    const bh = Math.max(2, max*h*0.88);
    ctx.fillStyle = color;
    ctx.fillRect(i*(w/bins), (h-bh)/2, w/bins-1, bh);
  }
}

function StemCard({ stem, onDownload }: { stem: StemResult; onDownload: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => { if (canvasRef.current) drawWaveform(canvasRef.current, stem.buffer, stem.color); }, [stem]);
  return (
    <div className="glass-card rounded-2xl p-5">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#111111" }}>{stem.name}</span>
          <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "#a3a3a3", marginLeft: 10 }}>
            {stem.name==="Bass"?"< 200 Hz":stem.name==="Mids"?"200 Hz – 4 kHz":"> 4 kHz"}
          </span>
        </div>
        <button onClick={onDownload} className="download-btn" style={{ padding: "8px 14px", fontSize: 12 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          WAV
        </button>
      </div>
      <div style={{ height: 60 }}>
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
      </div>
    </div>
  );
}

const S = { mono: { fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#a3a3a3" } };

const MAX_FILE_BYTES = 250 * 1024 * 1024; // 250MB, consistent with the Audio Converter tool

function revokeStems(stems: StemResult[]) {
  stems.forEach(s => URL.revokeObjectURL(s.url));
}

export default function StemSplitterClient() {
  const [isAdmin] = useState(() => { if (typeof window==="undefined") return false; try { return localStorage.getItem("andyk_lab_admin")==="true"; } catch { return false; } });

  const [file, setFile] = useState<File|null>(null);
  const [stems, setStems] = useState<StemResult[]>([]);
  const [stage, setStage] = useState<string|null>(null);
  const [error, setError] = useState<string|null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const stemsRef = useRef<StemResult[]>([]);
  useEffect(() => { stemsRef.current = stems; }, [stems]);

  // Revoke any outstanding stem blob URLs on unmount
  useEffect(() => () => revokeStems(stemsRef.current), []);

  const process = useCallback(async (f: File) => {
    revokeStems(stemsRef.current);
    setStage("Decoding…"); setStems([]); setError(null);
    try {
      const ab = await f.arrayBuffer();
      const audioCtx = new AudioContext();
      const buf = await audioCtx.decodeAudioData(ab);
      await audioCtx.close();

      const stemDefs: { name: string; type: "bass"|"mids"|"highs"; color: string }[] = [
        { name: "Bass",  type: "bass",  color: "rgba(0,0,0,0.7)" },
        { name: "Mids",  type: "mids",  color: "rgba(0,0,0,0.5)" },
        { name: "Highs", type: "highs", color: "rgba(0,0,0,0.35)" },
      ];

      const results: StemResult[] = [];
      for (const def of stemDefs) {
        setStage(`Rendering ${def.name}…`);
        const rendered = await renderStem(buf, def.type);
        const wavBytes = encodeWAV(rendered);
        const blob = new Blob([wavBytes], { type: "audio/wav" });
        const url = URL.createObjectURL(blob);
        results.push({ name: def.name, url, buffer: rendered, color: def.color });
      }
      setStems(results);
    } catch { setError("Failed to process audio. Please try an MP3 or WAV file."); }
    finally { setStage(null); }
  }, []);

  const handleFile = (f: File) => {
    setError(null);
    if (!f.type.match(/audio\//) && !f.name.match(/\.(mp3|wav|flac|ogg|aac|m4a)$/i)) {
      setError("Please upload an MP3, WAV, FLAC, OGG, AAC or M4A file.");
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      setError("File is too large (max 250MB). Please upload a smaller file.");
      return;
    }
    setFile(f); process(f);
  };

  const clear = () => { revokeStems(stemsRef.current); setStems([]); setFile(null); };

  const download = (stem: StemResult) => {
    const a = document.createElement("a");
    a.href = stem.url;
    a.download = `${file?.name.replace(/\.[^.]+$/,"") || "track"}_${stem.name.toLowerCase()}.wav`;
    a.click();
  };

  return (
    <div className="tool-page-bg">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="tool-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 2v20M2 12h20"/><circle cx="12" cy="12" r="4"/></svg>
            </div>
            <h1 style={{ fontSize: "clamp(1.5rem,3vw,2rem)", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--color-foreground)", lineHeight: 1.1 }}>
              <span className="head-word-serif serif-accent">Stem</span>{" "}
              <span className="head-word-bold">Splitter</span>
            </h1>
            {isAdmin && <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 100, background: "#111111", color: "#ffffff", fontWeight: 700 }}>Admin ✓</span>}
          </div>
          <p style={{ fontSize: 14, color: "var(--color-muted)", lineHeight: 1.65 }}>Split your track into Bass, Mids, and Highs stems using browser-based frequency filtering.</p>
          <div style={{ display: "inline-block", marginTop: 8, padding: "4px 10px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 6, fontSize: 11, color: "#92400e", fontFamily: "var(--font-mono)" }}>
            Browser approximation — uses frequency filtering, not AI source separation
          </div>
        </div>

        {!stems.length && !stage && <HowItWorks title="How Stem Splitting Works" steps={STEPS} privacyNote="Your audio never leaves your browser." />}

        {/* Upload */}
        {!stems.length && !stage && (
          <div className="upload-zone rounded-2xl p-10 flex flex-col items-center text-center cursor-pointer mb-4"
            onClick={() => inputRef.current?.click()}>
            <input ref={inputRef} type="file" accept="audio/*,.mp3,.wav" className="hidden"
              onChange={e => { const f=e.target.files?.[0]; if (f) handleFile(f); }} />
            <div style={{ width: 56, height: 56, borderRadius: 16, background: "var(--color-soft-green)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-deep-teal)" strokeWidth="1.8" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            </div>
            <p style={{ fontWeight: 600, color: "var(--color-foreground)" }}>Drop your MP3 or WAV here</p>
            <p style={{ fontSize: 12, color: "var(--color-muted-2)" }}>or click to browse · processed locally</p>
          </div>
        )}

        {error && <div style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", fontSize: 13, color: "#ef4444", marginBottom: 12 }}>{error}</div>}

        {/* Progress */}
        {stage && (
          <div style={{ padding: "16px", borderRadius: 14, background: "rgba(0,0,0,0.08)", border: "1px solid rgba(0,0,0,0.2)", display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid #111111", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
            <span style={{ fontWeight: 600, color: "#111111", fontSize: 14 }}>{stage}</span>
          </div>
        )}

        {/* Stems */}
        {stems.length > 0 && (
          <div className="animate-fade-up">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <div style={{ ...S.mono, marginBottom: 4 }}>Stems — {file?.name.replace(/\.[^.]+$/,"")}</div>
              </div>
              <button onClick={clear} style={{ fontSize: 12, color: "var(--color-muted-2)", background: "none", border: "none", cursor: "pointer" }}>
                ✕ Clear
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {stems.map(s => <StemCard key={s.name} stem={s} onDownload={() => download(s)} />)}
            </div>
          </div>
        )}
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );
}
