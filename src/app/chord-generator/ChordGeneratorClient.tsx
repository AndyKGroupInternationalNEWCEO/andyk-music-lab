"use client";

import { useState, useCallback } from "react";

const NOTES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const MAJOR_INTERVALS = [0,2,4,5,7,9,11];
const MINOR_INTERVALS = [0,2,3,5,7,8,10];

// Chord types: [intervals from root, quality]
const CHORD_TYPES: Record<string, [number[], string]> = {
  maj:  [[0,4,7], "maj"],
  min:  [[0,3,7], "min"],
  dim:  [[0,3,6], "dim"],
  aug:  [[0,4,8], "aug"],
  maj7: [[0,4,7,11], "maj7"],
  min7: [[0,3,7,10], "min7"],
  dom7: [[0,4,7,10], "7"],
};

// Diatonic chords per mode (scale degree → chord type)
const DIATONIC_MAJOR = ["maj","min","min","maj","maj","min","dim"];
const DIATONIC_MINOR = ["min","dim","maj","min","min","maj","maj"];

// Genre progressions: [degree indices (0-based), extra options]
type Genre = "trance"|"house"|"pop"|"cinematic";
const PROGRESSIONS: Record<Genre, Record<"major"|"minor", number[][]>> = {
  trance:    { major: [[0,5,2,6],[0,3,4,3],[3,4,0,4]], minor: [[0,5,2,6],[0,6,5,6],[0,2,3,5]] },
  house:     { major: [[0,4,5,3],[0,3,0,4],[1,4,0,5]], minor: [[0,6,5,6],[0,4,5,6],[0,2,5,3]] },
  pop:       { major: [[0,4,5,3],[0,5,3,4],[3,0,4,5]], minor: [[0,5,2,6],[0,6,3,5],[0,2,4,0]] },
  cinematic: { major: [[0,2,3,4],[0,5,2,3],[3,0,5,4]], minor: [[0,5,6,0],[0,2,5,6],[0,6,3,5]] },
};

const ROMAN_MAJOR = ["I","ii","iii","IV","V","vi","vii°"];
const ROMAN_MINOR = ["i","ii°","III","iv","v","VI","VII"];

function buildChord(rootNote: number, chordType: string): { name: string; notes: string[] } {
  const intervals = CHORD_TYPES[chordType][0];
  const notes = intervals.map(i => NOTES[(rootNote + i) % 12]);
  const quality = CHORD_TYPES[chordType][1];
  const name = NOTES[rootNote] + (quality === "maj" ? "" : quality === "min" ? "m" : quality);
  return { name, notes };
}

function getProgression(keyIdx: number, mode: "major"|"minor", degrees: number[]) {
  const scaleIntervals = mode==="major" ? MAJOR_INTERVALS : MINOR_INTERVALS;
  const diatonicTypes = mode==="major" ? DIATONIC_MAJOR : DIATONIC_MINOR;
  return degrees.map(deg => {
    const noteIdx = (keyIdx + scaleIntervals[deg]) % 12;
    const chord = buildChord(noteIdx, diatonicTypes[deg]);
    const roman = (mode==="major" ? ROMAN_MAJOR : ROMAN_MINOR)[deg];
    return { ...chord, roman, degree: deg };
  });
}

// Piano key positions (0-11 = C to B, in one octave)
const WHITE_KEYS = [0,2,4,5,7,9,11];
const BLACK_KEYS = [1,3,6,8,10];
const BLACK_OFFSETS: Record<number, number> = { 1: 14, 3: 42, 6: 98, 8: 126, 10: 154 };
const KEY_W = 28, KEY_H = 80, KEY_BW = 18, KEY_BH = 50;

function PianoChord({ notes, octaveOffset = 0 }: { notes: string[]; octaveOffset?: number }) {
  const highlighted = new Set(notes.map(n => NOTES.indexOf(n)));
  const totalW = WHITE_KEYS.length * KEY_W;
  return (
    <svg width={totalW} height={KEY_H} viewBox={`0 0 ${totalW} ${KEY_H}`} style={{ display: "block" }}>
      {WHITE_KEYS.map((noteIdx, i) => (
        <rect key={noteIdx} x={i*KEY_W} y={0} width={KEY_W-1} height={KEY_H}
          fill={highlighted.has(noteIdx) ? "#111111" : "#ffffff"}
          stroke="#e5e5e5" strokeWidth="1" rx="0" />
      ))}
      {WHITE_KEYS.map((noteIdx, i) => highlighted.has(noteIdx) && (
        <text key={`l${noteIdx}`} x={i*KEY_W + KEY_W/2} y={KEY_H-10} textAnchor="middle" fontSize="8" fontFamily="var(--font-mono)" fill="#ffffff">{NOTES[noteIdx]}</text>
      ))}
      {BLACK_KEYS.map(noteIdx => (
        <rect key={noteIdx} x={BLACK_OFFSETS[noteIdx]} y={0} width={KEY_BW} height={KEY_BH}
          fill={highlighted.has(noteIdx) ? "#525252" : "#111111"}
          stroke="none" rx="0" />
      ))}
      {BLACK_KEYS.map(noteIdx => highlighted.has(noteIdx) && (
        <text key={`lb${noteIdx}`} x={BLACK_OFFSETS[noteIdx]+KEY_BW/2} y={KEY_BH-8} textAnchor="middle" fontSize="7" fontFamily="var(--font-mono)" fill="#ffffff">{NOTES[noteIdx]}</text>
      ))}
    </svg>
  );
}

const S = { mono: { fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#a3a3a3" } };

export default function ChordGeneratorClient() {
  const [isAdmin] = useState(() => { if (typeof window==="undefined") return false; try { return localStorage.getItem("andyk_lab_admin")==="true"; } catch { return false; } });

  const [keyNote, setKeyNote] = useState("C");
  const [mode, setMode] = useState<"major"|"minor">("minor");
  const [genre, setGenre] = useState<Genre>("trance");
  const [copied, setCopied] = useState(false);

  const keyIdx = NOTES.indexOf(keyNote);
  const progressions = PROGRESSIONS[genre][mode];
  const allProgs = progressions.map(degrees => getProgression(keyIdx, mode, degrees));

  const copyText = useCallback(() => {
    const lines = allProgs.map((prog, i) => {
      const chords = prog.map(c => c.name).join(" – ");
      const romans = prog.map(c => c.roman).join(" – ");
      return `Variation ${i+1}: ${chords} (${romans})`;
    }).join("\n");
    navigator.clipboard.writeText(`Key: ${keyNote} ${mode}\nGenre: ${genre}\n\n${lines}`).then(() => { setCopied(true); setTimeout(()=>setCopied(false), 2000); });
  }, [allProgs, keyNote, mode, genre]);

  return (
    <div className="tool-page-bg">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="tool-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="4" width="3" height="16" rx="1"/><rect x="7" y="7" width="3" height="10" rx="1"/><rect x="12" y="4" width="3" height="16" rx="1"/><rect x="17" y="7" width="3" height="10" rx="1"/></svg>
            </div>
            <h1 style={{ fontSize: "clamp(1.5rem,3vw,2rem)", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--color-foreground)", lineHeight: 1.1 }}>
              <span className="head-word-serif serif-accent">Chord</span>{" "}
              <span className="head-word-bold">Generator</span>
            </h1>
            {isAdmin && <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 100, background: "#111111", color: "#ffffff", fontWeight: 700 }}>Admin ✓</span>}
          </div>
          <p style={{ fontSize: 14, color: "var(--color-muted)", lineHeight: 1.65, maxWidth: 520 }}>Select a key, mode, and genre feel to generate chord progressions with piano voicings.</p>
        </div>

        {/* Controls */}
        <div className="glass-card rounded-2xl p-5 mb-6">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 16 }}>
            {/* Key */}
            <div>
              <div style={{ ...S.mono, marginBottom: 8 }}>Root Key</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {NOTES.map(n => (
                  <button key={n} onClick={() => setKeyNote(n)}
                    style={{ padding: "5px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono)", border: `1px solid ${keyNote===n?"#111111":"var(--color-grid-500)"}`, background: keyNote===n?"#111111":"transparent", color: keyNote===n?"#ffffff":"var(--color-muted)", cursor: "pointer" }}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Mode */}
            <div>
              <div style={{ ...S.mono, marginBottom: 8 }}>Mode</div>
              <div style={{ display: "flex", gap: 6 }}>
                {(["major","minor"] as const).map(m => (
                  <button key={m} onClick={() => setMode(m)}
                    style={{ flex: 1, padding: "8px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1px solid ${mode===m?"#111111":"var(--color-grid-500)"}`, background: mode===m?"#111111":"transparent", color: mode===m?"#ffffff":"var(--color-muted)", cursor: "pointer", textTransform: "capitalize" }}>
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Genre */}
            <div>
              <div style={{ ...S.mono, marginBottom: 8 }}>Genre Feel</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(["trance","house","pop","cinematic"] as Genre[]).map(g => (
                  <button key={g} onClick={() => setGenre(g)}
                    style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1px solid ${genre===g?"#111111":"var(--color-grid-500)"}`, background: genre===g?"#111111":"transparent", color: genre===g?"#ffffff":"var(--color-muted)", cursor: "pointer", textTransform: "capitalize" }}>
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Progressions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 24 }}>
          {allProgs.map((prog, pi) => (
            <div key={pi} className="glass-card rounded-2xl p-5">
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <span style={{ ...S.mono }}>Variation {pi+1}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-foreground)", fontFamily: "var(--font-mono)" }}>
                  {prog.map(c => c.roman).join(" – ")}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
                {prog.map((chord, ci) => (
                  <div key={ci} style={{ textAlign: "center" as const }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#111111", letterSpacing: "-0.02em", marginBottom: 2 }}>{chord.name}</div>
                    <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "#a3a3a3", marginBottom: 8 }}>{chord.notes.join(" · ")}</div>
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <PianoChord notes={chord.notes} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button onClick={copyText}
          style={{ width: "100%", padding: "13px", background: copied ? "rgba(0,0,0,0.12)" : "transparent", border: "1px solid var(--color-grid-500)", color: copied ? "#111111" : "var(--color-muted)", fontSize: 13, fontWeight: 600, cursor: "pointer", borderRadius: 12, transition: "all 0.2s ease" }}>
          {copied ? "✓ Copied to clipboard" : "Copy All Progressions"}
        </button>
      </div>
    </div>
  );
}
