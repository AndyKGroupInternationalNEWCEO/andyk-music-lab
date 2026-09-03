"use client";

import { useState, useRef, useEffect, useCallback } from "react";

type TimeSig = "2/4"|"3/4"|"4/4"|"6/8";
type Subdivision = "quarter"|"eighth"|"sixteenth";

const SIG_BEATS: Record<TimeSig, number> = { "2/4": 2, "3/4": 3, "4/4": 4, "6/8": 6 };

const S = { mono: { fontFamily: "var(--font-mono)", letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "#a3a3a3", fontSize: 11 } };

export default function MetronomeClient() {
  const [isAdmin] = useState(() => { if (typeof window==="undefined") return false; try { return localStorage.getItem("andyk_lab_admin")==="true"; } catch { return false; } });

  const [bpm, setBpm] = useState(120);
  const [playing, setPlaying] = useState(false);
  const [timeSig, setTimeSig] = useState<TimeSig>("4/4");
  const [subdivision, setSubdivision] = useState<Subdivision>("quarter");
  const [currentBeat, setCurrentBeat] = useState(0);
  const [pulse, setPulse] = useState(false);
  const [taps, setTaps] = useState<number[]>([]);

  const audioCtxRef = useRef<AudioContext|null>(null);
  const timerRef = useRef<number>(0);
  const nextNoteRef = useRef(0);
  const beatRef = useRef(0);
  const bpmRef = useRef(bpm);
  const timeSigRef = useRef(timeSig);
  const subdivRef = useRef(subdivision);
  const uiTimeoutsRef = useRef<number[]>([]);

  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { timeSigRef.current = timeSig; }, [timeSig]);
  useEffect(() => { subdivRef.current = subdivision; }, [subdivision]);

  const scheduleClick = useCallback((beat: number, time: number) => {
    const ctx = audioCtxRef.current!;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.connect(env); env.connect(ctx.destination);
    const totalBeats = SIG_BEATS[timeSigRef.current];
    const isAccent = beat % totalBeats === 0;
    osc.frequency.value = isAccent ? 1050 : 880;
    env.gain.setValueAtTime(isAccent ? 0.8 : 0.5, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.06);
    osc.start(time); osc.stop(time + 0.06);
    // Schedule UI beat indicator — tracked so stop() can cancel any still-pending pulses
    const delay = Math.max(0, (time - ctx.currentTime) * 1000);
    const id = window.setTimeout(() => {
      setCurrentBeat(beat % totalBeats); setPulse(true);
      const offId = window.setTimeout(() => setPulse(false), 80);
      uiTimeoutsRef.current.push(offId);
    }, delay);
    uiTimeoutsRef.current.push(id);
  }, []);

  // schedulerRef holds the latest scheduler so the recursive setTimeout below never
  // captures a stale self-reference (fixes react-hooks/immutability: "scheduler
  // accessed before it is declared").
  const schedulerRef = useRef<() => void>(() => {});

  const scheduler = useCallback(() => {
    const ctx = audioCtxRef.current!;
    const subdivFactor = subdivRef.current === "quarter" ? 1 : subdivRef.current === "eighth" ? 2 : 4;
    const secPerBeat = 60 / (bpmRef.current * subdivFactor);
    while (nextNoteRef.current < ctx.currentTime + 0.1) {
      scheduleClick(beatRef.current, nextNoteRef.current);
      beatRef.current++;
      nextNoteRef.current += secPerBeat;
    }
    timerRef.current = window.setTimeout(() => schedulerRef.current(), 25);
  }, [scheduleClick]);

  useEffect(() => { schedulerRef.current = scheduler; }, [scheduler]);

  const start = useCallback(() => {
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    beatRef.current = 0;
    nextNoteRef.current = ctx.currentTime + 0.05;
    setPlaying(true);
    scheduler();
  }, [scheduler]);

  const stop = useCallback(() => {
    clearTimeout(timerRef.current);
    uiTimeoutsRef.current.forEach(clearTimeout);
    uiTimeoutsRef.current = [];
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    setPlaying(false);
    setCurrentBeat(0);
    setPulse(false);
  }, []);

  useEffect(() => { return () => {
    clearTimeout(timerRef.current);
    uiTimeoutsRef.current.forEach(clearTimeout);
    audioCtxRef.current?.close();
  }; }, []);

  const tap = () => {
    const now = Date.now();
    setTaps(prev => {
      const recent = [...prev.filter(t => now-t < 5000), now];
      if (recent.length >= 2) {
        const avg = (recent[recent.length-1]-recent[0])/(recent.length-1);
        const newBpm = Math.round(Math.min(220, Math.max(40, 60000/avg)));
        setBpm(newBpm);
        if (playing) { stop(); setTimeout(start, 50); }
      }
      return recent;
    });
  };

  const adjust = (delta: number) => setBpm(b => Math.max(40, Math.min(220, b+delta)));

  const totalBeats = SIG_BEATS[timeSig];
  const beatDots = Array.from({ length: totalBeats }, (_, i) => i);

  return (
    <div className="tool-page-bg">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="tool-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="6" x2="12" y2="12"/><line x1="12" y1="12" x2="16" y2="14"/></svg>
            </div>
            <h1 style={{ fontSize: "clamp(1.5rem,3vw,2rem)", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--color-foreground)", lineHeight: 1.1 }}>
              <span className="head-word-bold">Metro</span>
              <span className="head-word-serif serif-accent">nome</span>
            </h1>
            {isAdmin && <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 100, background: "#111111", color: "#ffffff", fontWeight: 700 }}>Admin ✓</span>}
          </div>
          <p style={{ fontSize: 14, color: "var(--color-muted)", lineHeight: 1.65 }}>Precise Web Audio API metronome with tap tempo, time signatures, and subdivisions.</p>
        </div>

        {/* Beat pulse */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 40 }}>
          <div style={{
            width: 160, height: 160, borderRadius: "50%",
            background: pulse ? "#111111" : "var(--color-grid-300)",
            border: `3px solid ${pulse ? "#111111" : "var(--color-grid-500)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.05s ease, border-color 0.05s ease",
          }}>
            <span style={{ fontSize: 56, fontWeight: 900, fontFamily: "var(--font-mono)", color: pulse ? "#ffffff" : "#111111", lineHeight: 1 }}>
              {bpm}
            </span>
          </div>
        </div>

        {/* Beat dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 32 }}>
          {beatDots.map(i => (
            <div key={i} style={{
              width: 14, height: 14, borderRadius: "50%",
              background: playing && currentBeat===i ? "#111111" : "var(--color-grid-500)",
              transition: "background 0.05s ease",
            }} />
          ))}
        </div>

        {/* BPM controls */}
        <div className="glass-card rounded-2xl p-6 mb-4">
          <div style={{ ...S.mono, marginBottom: 12 }}>BPM — 40 to 220</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <button onClick={() => adjust(-10)} style={{ width: 40, height: 40, borderRadius: 10, border: "1px solid var(--color-grid-500)", background: "transparent", color: "var(--color-muted)", fontSize: 16, cursor: "pointer" }}>−−</button>
            <button onClick={() => adjust(-1)} style={{ width: 40, height: 40, borderRadius: 10, border: "1px solid var(--color-grid-500)", background: "transparent", color: "var(--color-muted)", fontSize: 18, cursor: "pointer" }}>−</button>
            <input type="range" min={40} max={220} value={bpm}
              onChange={e => setBpm(+e.target.value)}
              style={{ flex: 1, accentColor: "#111111" }} />
            <button onClick={() => adjust(1)} style={{ width: 40, height: 40, borderRadius: 10, border: "1px solid var(--color-grid-500)", background: "transparent", color: "var(--color-muted)", fontSize: 18, cursor: "pointer" }}>+</button>
            <button onClick={() => adjust(10)} style={{ width: 40, height: 40, borderRadius: 10, border: "1px solid var(--color-grid-500)", background: "transparent", color: "var(--color-muted)", fontSize: 16, cursor: "pointer" }}>++</button>
          </div>
          <div style={{ fontSize: 12, color: "#a3a3a3", fontFamily: "var(--font-mono)" }}>
            {bpm < 66 ? "Larghetto" : bpm < 76 ? "Adagio" : bpm < 108 ? "Andante" : bpm < 120 ? "Moderato" : bpm < 156 ? "Allegro" : bpm < 176 ? "Vivace" : "Presto"}
          </div>
        </div>

        {/* Time signature + subdivision */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="glass-card rounded-2xl p-5">
            <div style={{ ...S.mono, marginBottom: 10 }}>Time Signature</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(["2/4","3/4","4/4","6/8"] as TimeSig[]).map(t => (
                <button key={t} onClick={() => setTimeSig(t)}
                  style={{ padding: "6px 12px", borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)", border: `1px solid ${timeSig===t?"#111111":"var(--color-grid-500)"}`, background: timeSig===t?"#111111":"transparent", color: timeSig===t?"#ffffff":"var(--color-muted)", cursor: "pointer" }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="glass-card rounded-2xl p-5">
            <div style={{ ...S.mono, marginBottom: 10 }}>Subdivision</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(["quarter","eighth","sixteenth"] as Subdivision[]).map(s => (
                <button key={s} onClick={() => setSubdivision(s)}
                  style={{ padding: "6px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, border: `1px solid ${subdivision===s?"#111111":"var(--color-grid-500)"}`, background: subdivision===s?"#111111":"transparent", color: subdivision===s?"#ffffff":"var(--color-muted)", cursor: "pointer", textTransform: "capitalize" }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tap + Start */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <button onClick={tap}
            style={{ padding: "16px", background: "var(--color-grid-300)", border: "1px solid var(--color-grid-500)", color: "var(--color-foreground)", fontSize: 14, fontWeight: 700, fontFamily: "var(--font-mono)", cursor: "pointer", borderRadius: 14, letterSpacing: "0.08em" }}>
            TAP TEMPO
          </button>
          <button onClick={playing ? stop : start}
            style={{ padding: "16px", background: playing ? "rgba(239,68,68,0.1)" : "#111111", border: playing ? "1px solid rgba(239,68,68,0.3)" : "none", color: playing ? "#ef4444" : "#ffffff", fontSize: 14, fontWeight: 700, cursor: "pointer", borderRadius: 14 }}>
            {playing ? "■ STOP" : "▶ START"}
          </button>
        </div>
      </div>
    </div>
  );
}
