"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import HowItWorks from "@/components/HowItWorks";
import { Mp3Encoder } from "lamejs";

const CONVERTER_STEPS = [
  { text: "Your file is loaded locally via the Web Audio API — nothing leaves your browser." },
  { text: "The browser decodes WAV, MP3, FLAC, and AAC natively (FLAC/AAC support varies by browser — Chrome and Safari cover both)." },
  { text: "You choose the output format: WAV (16-bit lossless) or MP3 at 192 or 320 kbps." },
  { text: "WAV is encoded as interleaved 16-bit PCM. MP3 is encoded using lamejs — the same encoder as the Mastering Tool." },
];

type OutputFormat = "wav" | "mp3_192" | "mp3_320";

interface FileInfo {
  name: string;
  ext: string;
  duration: number;
  channels: number;
  sampleRate: number;
  buffer: AudioBuffer;
}

// ── Encoders (same logic as MasteringClient, isolated copies) ────────────────

function encodeWAV(buf: AudioBuffer): ArrayBuffer {
  const numCh = buf.numberOfChannels, sr = buf.sampleRate, numSamples = buf.length;
  const bitsPerSample = 16, bytesPerSample = bitsPerSample / 8;
  const blockAlign = numCh * bytesPerSample, byteRate = sr * blockAlign;
  const dataBytes = numSamples * blockAlign;
  const ab = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(ab);
  const write = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  write(0, "RIFF"); view.setUint32(4, 36 + dataBytes, true); write(8, "WAVE");
  write(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, numCh, true); view.setUint32(24, sr, true); view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true); view.setUint16(34, bitsPerSample, true);
  write(36, "data"); view.setUint32(40, dataBytes, true);
  let offset = 44;
  const channels = Array.from({ length: numCh }, (_, c) => buf.getChannelData(c));
  for (let i = 0; i < numSamples; i++) {
    for (let c = 0; c < numCh; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, s < 0 ? s * 32768 : s * 32767, true); offset += 2;
    }
  }
  return ab;
}

function encodeMp3(buf: AudioBuffer, kbps: 192 | 320): Blob {
  const numCh = Math.min(buf.numberOfChannels, 2);
  const encoder = new Mp3Encoder(numCh, buf.sampleRate, kbps);
  const CHUNK = 1152;
  const left  = buf.getChannelData(0);
  const right = numCh > 1 ? buf.getChannelData(1) : left;
  const toInt16 = (f: Float32Array) => Int16Array.from(f, s => Math.max(-32768, Math.min(32767, Math.round(s * 32767))));
  const mp3: Int8Array[] = [];
  for (let i = 0; i < left.length; i += CHUNK) {
    const l = toInt16(left.slice(i, i + CHUNK));
    const r = toInt16(right.slice(i, i + CHUNK));
    const enc = encoder.encodeBuffer(l, r);
    if (enc.length > 0) mp3.push(enc);
  }
  const end = encoder.flush();
  if (end.length > 0) mp3.push(end);
  return new Blob(mp3.map(b => b.buffer as ArrayBuffer), { type: "audio/mp3" });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatSampleRate(hz: number): string {
  return `${(hz / 1000).toFixed(1)} kHz`;
}

const OUTPUT_OPTIONS: { value: OutputFormat; label: string; desc: string }[] = [
  { value: "wav",     label: "WAV",      desc: "16-bit lossless" },
  { value: "mp3_192", label: "MP3 192k", desc: "compressed" },
  { value: "mp3_320", label: "MP3 320k", desc: "high quality" },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function AudioConverterClient() {
  const [dragOver, setDragOver]       = useState(false);
  const [fileInfo, setFileInfo]       = useState<FileInfo | null>(null);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("wav");
  const [stage, setStage]             = useState<string | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const downloadUrlRef = useRef<string | null>(null);
  useEffect(() => { downloadUrlRef.current = downloadUrl; }, [downloadUrl]);

  // Revoke any outstanding converted-file blob URL on unmount
  useEffect(() => () => { if (downloadUrlRef.current) URL.revokeObjectURL(downloadUrlRef.current); }, []);

  const mono: React.CSSProperties = { fontFamily: "var(--font-mono)" };
  const label10: React.CSSProperties = { ...mono, fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "var(--color-muted-2)", margin: 0 };

  const clearDownloadUrl = () => {
    if (downloadUrlRef.current) URL.revokeObjectURL(downloadUrlRef.current);
    setDownloadUrl(null);
  };

  const reset = () => {
    setFileInfo(null);
    clearDownloadUrl();
    setDownloadName("");
    setError(null);
    setOutputFormat("wav");
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = useCallback(async (f: File) => {
    setError(null);
    clearDownloadUrl();
    setFileInfo(null);
    if (f.size > 250 * 1024 * 1024) {
      setError("File is too large (max 250 MB). Use a desktop DAW for larger files.");
      return;
    }
    setStage("Decoding…");
    let audioCtx: AudioContext | null = null;
    try {
      const ab = await f.arrayBuffer();
      audioCtx = new AudioContext();
      const buffer = await audioCtx.decodeAudioData(ab);
      await audioCtx.close();
      audioCtx = null;
      const ext = (f.name.split(".").pop() ?? "").toLowerCase();
      setFileInfo({
        name: f.name.replace(/\.[^.]+$/, ""),
        ext,
        duration: buffer.duration,
        channels: buffer.numberOfChannels,
        sampleRate: buffer.sampleRate,
        buffer,
      });
    } catch {
      if (audioCtx) await audioCtx.close().catch(() => {});
      setError("Could not decode this file. Supported inputs: WAV, MP3, FLAC, AAC. FLAC/AAC require Chrome or Safari.");
    } finally {
      setStage(null);
    }
  }, []);

  const convert = async () => {
    if (!fileInfo) return;
    setError(null);
    clearDownloadUrl();
    setStage("Encoding…");
    try {
      let blob: Blob;
      let ext: string;
      if (outputFormat === "wav") {
        blob = new Blob([encodeWAV(fileInfo.buffer)], { type: "audio/wav" });
        ext = "wav";
      } else {
        const kbps = outputFormat === "mp3_320" ? 320 : 192;
        blob = encodeMp3(fileInfo.buffer, kbps);
        ext = "mp3";
      }
      const url = URL.createObjectURL(blob);
      const name = `${fileInfo.name}_converted.${ext}`;
      setDownloadUrl(url);
      setDownloadName(name);
    } catch {
      setError("Conversion failed. Please try again.");
    } finally {
      setStage(null);
    }
  };

  const triggerDownload = () => {
    if (!downloadUrl) return;
    const a = document.createElement("a");
    a.href = downloadUrl; a.download = downloadName; a.click();
  };

  const outputLabel = outputFormat === "wav" ? "WAV" : outputFormat === "mp3_320" ? "MP3 320k" : "MP3 192k";

  return (
    <div className="tool-page-bg">
      <div className="max-w-3xl mx-auto px-6 py-12">

        {/* ── Header ── */}
        <div className="mb-10">
          <p style={{ ...mono, fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--color-muted-2)", margin: "0 0 10px" }}>
            Andy&apos;K Music Lab
          </p>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.025em", color: "var(--color-text-primary)", margin: "0 0 6px" }}>
            Audio Converter
          </h1>
          <p style={{ fontSize: 14, color: "var(--color-muted-2)", margin: 0 }}>
            Convert WAV / MP3 / FLAC / AAC to WAV or MP3 — entirely in your browser, nothing uploaded.
          </p>
        </div>

        {/* ── Upload zone ── */}
        <div
          className={`upload-zone rounded-2xl p-12 flex flex-col items-center justify-center text-center cursor-pointer mb-4 ${dragOver ? "drag-over" : ""}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="audio/*,.wav,.mp3,.flac,.aac,.m4a"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          <div style={{ fontSize: 32, marginBottom: 12, lineHeight: 1 }}>♪</div>
          <p style={{ ...mono, fontSize: 13, fontWeight: 700, color: "var(--color-text-primary)", margin: "0 0 6px" }}>
            {fileInfo ? `${fileInfo.name}.${fileInfo.ext}` : "Drop your audio file here"}
          </p>
          <p style={{ fontSize: 12, color: "var(--color-muted-2)", margin: 0 }}>
            {fileInfo ? "Click to change file" : "WAV · MP3 · FLAC · AAC — or click to browse · processed locally, no upload"}
          </p>
        </div>

        {/* ── File info ── */}
        {fileInfo && (
          <div className="glass-card rounded-2xl p-5 mb-4">
            <p style={{ ...label10, marginBottom: 14 }}>Source File</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 16 }}>
              {[
                { label: "FORMAT",      value: fileInfo.ext.toUpperCase() },
                { label: "DURATION",    value: formatDuration(fileInfo.duration) },
                { label: "CHANNELS",    value: fileInfo.channels === 1 ? "Mono" : fileInfo.channels === 2 ? "Stereo" : `${fileInfo.channels}ch` },
                { label: "SAMPLE RATE", value: formatSampleRate(fileInfo.sampleRate) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p style={{ ...mono, fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-muted-2)", margin: "0 0 4px" }}>{label}</p>
                  <p style={{ ...mono, fontSize: 15, fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Output format ── */}
        {fileInfo && (
          <div className="glass-card rounded-2xl p-5 mb-4">
            <p style={{ ...label10, marginBottom: 14 }}>Output Format</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {OUTPUT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setOutputFormat(opt.value)}
                  className={`preset-btn ${outputFormat === opt.value ? "active" : ""}`}
                >
                  <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                    <span>{opt.label}</span>
                    <span style={{ fontSize: 9, opacity: 0.65, fontWeight: 400, letterSpacing: 0 }}>{opt.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.25)", borderRadius: 12, padding: "12px 16px", marginBottom: 16, ...mono, fontSize: 12, color: "#dc2626" }}>
            {error}
          </div>
        )}

        {/* ── Stage indicator ── */}
        {stage && (
          <p style={{ ...mono, fontSize: 12, color: "var(--color-muted-2)", textAlign: "center", marginBottom: 16 }}>
            {stage}
          </p>
        )}

        {/* ── Convert button ── */}
        {fileInfo && !downloadUrl && (
          <button
            onClick={convert}
            disabled={!!stage}
            className="download-btn"
            style={{ width: "100%", justifyContent: "center", fontSize: 15, marginBottom: 8 }}
          >
            Convert to {outputLabel}
          </button>
        )}

        {/* ── Download + reset ── */}
        {downloadUrl && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              onClick={triggerDownload}
              className="download-btn"
              style={{ width: "100%", justifyContent: "center", fontSize: 15 }}
            >
              ↓ Download {downloadName}
            </button>
            <button
              onClick={reset}
              style={{ width: "100%", padding: "12px", background: "transparent", border: "1px solid var(--color-grid-500)", borderRadius: 12, ...mono, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", cursor: "pointer", color: "var(--color-muted-2)" }}
            >
              Convert Another File
            </button>
          </div>
        )}

        <div style={{ marginTop: 32 }}>
          <HowItWorks
            title="How Audio Converter Works"
            steps={CONVERTER_STEPS}
            privacyNote="Your audio never leaves your browser. All decoding and encoding runs locally via the Web Audio API and lamejs."
          />
        </div>

      </div>
    </div>
  );
}
