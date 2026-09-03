"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import HowItWorks from "@/components/HowItWorks";
import { Mp3Encoder } from "lamejs";
import JSZip from "jszip";

const MASTERING_STEPS = [
  { text: "Your file is loaded locally via the Web Audio API — nothing leaves your browser." },
  { text: "We analyse LUFS, peak dBFS, BPM, and musical key." },
  { text: "EQ correction is applied: low-cut at 30 Hz, optional high-shelf at 12 kHz." },
  { text: "Loudness is normalised to your chosen platform standard (e.g. Spotify −14 LUFS)." },
  { text: "Stereo widening via mid/side phase processing." },
  { text: "True-peak limiter at −0.3 dBTP protects against clipping." },
  { text: "The mastered file is encoded as a 16-bit WAV and offered for download." },
  { text: "Your audio never leaves your browser — 100% private.", warning: true },
];

// ── Constants ──────────────────────────────────────────────────────────────
const MAX_FILE_BYTES = 250 * 1024 * 1024; // 250MB, consistent with the Audio Converter tool
const PLATFORM_LUFS = { spotify: -14, apple: -16, youtube: -14 } as const;
const INTENSITY_OFFSET = { low: -4, medium: 0, high: 3 } as const;
const STEREO_FACTOR = { narrow: 0.45, standard: 1.0, wide: 1.75 } as const;
const NOISE_CUTOFF = { low: 30, medium: 60, high: 100 } as const;

type Intensity = "low" | "medium" | "high";
type StereoWidth = "narrow" | "standard" | "wide";
type NoiseLevel = "low" | "medium" | "high";
type Platform = "spotify" | "apple" | "youtube";
type Preset = "club" | "radio" | "streaming" | "vinyl" | "halsey" | "djandyk_master" | "custom";

interface Settings {
  intensity: Intensity; stereoWidth: StereoWidth; noiseLevel: NoiseLevel;
  autoEQ: boolean; lowCut: boolean; highShelf: boolean; limiter: boolean;
  platform: Platform; eqBands: [number, number, number, number, number];
  truePeak?: number;
}

const PRESETS: Record<Exclude<Preset, "custom" | "djandyk_master">, Settings> = {
  club:      { intensity: "high",   stereoWidth: "wide",     noiseLevel: "medium", autoEQ: true,  lowCut: true,  highShelf: true,  limiter: true,  platform: "spotify", eqBands: [3, 2, 0, 2, 1] },
  radio:     { intensity: "high",   stereoWidth: "standard", noiseLevel: "high",   autoEQ: true,  lowCut: true,  highShelf: false, limiter: true,  platform: "apple",   eqBands: [1, 0, 1, 3, 2] },
  streaming: { intensity: "medium", stereoWidth: "standard", noiseLevel: "medium", autoEQ: true,  lowCut: false, highShelf: false, limiter: true,  platform: "spotify", eqBands: [0, 0, 0, 0, 0] },
  vinyl:     { intensity: "low",    stereoWidth: "narrow",   noiseLevel: "low",    autoEQ: false, lowCut: false, highShelf: true,  limiter: false, platform: "apple",   eqBands: [2, 1, -1, 1, 2] },
  halsey:    { intensity: "high",   stereoWidth: "standard", noiseLevel: "medium", autoEQ: true,  lowCut: true,  highShelf: false, limiter: true,  platform: "spotify", eqBands: [-2, -1, 0, 3, 1], truePeak: -1.0 },
};

interface Analysis {
  bpm: number; keyNote: string; keyMode: "major" | "minor";
  pitch: number; danceability: number; lufs: number; peak: number; dr: number;
}
interface MasterResult {
  url: string; buffer: AudioBuffer;
  stats: { lufs: number; peak: number; dr: number };
}

// ── Music theory ───────────────────────────────────────────────────────────
const MAJOR_PROFILE = [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
const MINOR_PROFILE = [6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];
const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

// ── Audio DSP helpers ──────────────────────────────────────────────────────
function computeStats(buf: AudioBuffer): { lufs: number; peak: number; dr: number } {
  const L = buf.getChannelData(0);
  const R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
  let sumSq = 0, peak = 0;
  const blockSize = Math.floor(buf.sampleRate * 0.4);
  const blocks: number[] = [];
  for (let i = 0; i < L.length; i++) {
    const s = (Math.abs(L[i]) + Math.abs(R[i])) / 2;
    if (s > peak) peak = s;
    sumSq += s * s;
  }
  for (let b = 0; b + blockSize < L.length; b += blockSize) {
    let bSq = 0;
    for (let i = 0; i < blockSize; i++) bSq += ((L[b+i]+R[b+i])/2) ** 2;
    blocks.push(bSq / blockSize);
  }
  blocks.sort((a, b) => b - a);
  const loudRms = Math.sqrt(blocks[0] || 1e-10);
  const quietRms = Math.sqrt(blocks[Math.floor(blocks.length * 0.3)] || 1e-10);
  const dr = Math.max(0, Math.round(20 * Math.log10(loudRms / (quietRms + 1e-9))));
  const rms = Math.sqrt(sumSq / L.length);
  const lufs = Math.round((20 * Math.log10(rms + 1e-9) - 0.691) * 10) / 10;
  const peakDb = Math.round(20 * Math.log10(peak + 1e-9) * 10) / 10;
  return { lufs, peak: peakDb, dr };
}

function correlate(chroma: number[], profile: number[]): number {
  const n = 12, mC = chroma.reduce((a,b)=>a+b,0)/n, mP = profile.reduce((a,b)=>a+b,0)/n;
  let num=0,dc=0,dp=0;
  for(let i=0;i<n;i++){const cc=chroma[i]-mC,pp=profile[i]-mP;num+=cc*pp;dc+=cc*cc;dp+=pp*pp;}
  return num/(Math.sqrt(dc)*Math.sqrt(dp)+1e-9);
}

async function analyzeBuffer(buf: AudioBuffer, admin = false): Promise<Analysis> {
  const sr = buf.sampleRate, data = buf.getChannelData(0);
  const stats = computeStats(buf);

  // Key
  const fftSize=4096, chroma=new Array(12).fill(0), step=Math.floor(data.length/20);
  for(let s=0;s+fftSize<data.length;s+=step){
    const win=new Float32Array(fftSize);
    for(let i=0;i<fftSize;i++) win[i]=data[s+i]*(0.5-0.5*Math.cos(2*Math.PI*i/(fftSize-1)));
    for(let bin=1;bin<fftSize/2;bin++){
      const freq=(bin*sr)/fftSize;
      if(freq<55||freq>4000)continue;
      let re=0,im=0;
      for(let i=0;i<fftSize;i++){const a=2*Math.PI*bin*i/fftSize;re+=win[i]*Math.cos(a);im-=win[i]*Math.sin(a);}
      const mag=Math.sqrt(re*re+im*im);
      const midi=Math.round(12*Math.log2(freq/440)+69);
      if(midi>=0)chroma[((midi%12)+12)%12]+=mag;
    }
  }
  let bestCorr=-Infinity,bestNote=0,bestMode:"major"|"minor"="major";
  for(let shift=0;shift<12;shift++){
    const rot=[...chroma.slice(shift),...chroma.slice(0,shift)];
    const maj=correlate(rot,MAJOR_PROFILE),min=correlate(rot,MINOR_PROFILE);
    if(maj>bestCorr){bestCorr=maj;bestNote=shift;bestMode="major";}
    if(min>bestCorr){bestCorr=min;bestNote=shift;bestMode="minor";}
  }

  // BPM
  const frameSize=512,hopSize=256,frames:number[]=[];
  const limit = admin ? data.length : Math.min(data.length, sr * 90);
  for(let i=0;i+frameSize<limit;i+=hopSize){let e=0;for(let j=0;j<frameSize;j++)e+=data[i+j]*data[i+j];frames.push(e/frameSize);}
  const maxE=Math.max(...frames);const norm=frames.map(e=>e/(maxE+1e-9));
  const minLag=Math.round(60*sr/(180*hopSize)),maxLag=Math.round(60*sr/(40*hopSize));
  let bestC=-Infinity,bestLag=minLag;
  for(let lag=minLag;lag<=maxLag&&lag<frames.length/2;lag++){let c=0;const n=frames.length-lag;for(let i=0;i<n;i++)c+=norm[i]*norm[i+lag];c/=n;if(c>bestC){bestC=c;bestLag=lag;}}
  let bpm=(60*sr)/(bestLag*hopSize);while(bpm>175)bpm/=2;while(bpm<80)bpm*=2;bpm=Math.round(bpm);

  // Pitch
  const mid=Math.floor(data.length/2),minP=Math.floor(sr/1800),maxP=Math.floor(sr/80);
  let pc=-1,pp=maxP;
  for(let p=minP;p<=maxP;p++){let c=0;for(let i=0;i<2048-p;i++)c+=data[mid+i]*data[mid+i+p];if(c>pc){pc=c;pp=p;}}
  const pitch=Math.round(sr/pp);

  // Danceability
  const energy=computeStats(buf).lufs;
  const bpmScore=Math.max(0,100-Math.abs(bpm-128)*1.5);
  const energyScore=Math.max(0,Math.min(100,((energy+40)/40)*100));
  const danceability=Math.round(0.45*bpmScore+0.55*energyScore);

  return { bpm, keyNote: NOTE_NAMES[bestNote], keyMode: bestMode, pitch, danceability, ...stats };
}

// ── DJ Andy'K Master — isolated DSP functions (used exclusively by this preset) ──

function dcOffsetClean(data: Float32Array): void {
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i];
  const mean = sum / data.length;
  for (let i = 0; i < data.length; i++) data[i] -= mean;
}

function softLimitTanh(data: Float32Array, ceilingDb = -1.0, kneePercent = 76): void {
  const ceiling = Math.pow(10, ceilingDb / 20);
  const knee = ceiling * (kneePercent / 100);
  const range = ceiling - knee;
  for (let i = 0; i < data.length; i++) {
    const abs = Math.abs(data[i]);
    if (abs <= knee) continue;
    const sign = data[i] < 0 ? -1 : 1;
    const excess = (abs - knee) / range;
    data[i] = sign * (knee + range * Math.tanh(excess));
  }
}

async function masterAudioDjAndyK(
  buf: AudioBuffer,
  onStage: (s: string) => void
): Promise<MasterResult> {
  onStage("Cleaning DC offset…");
  const sr = buf.sampleRate;
  const srcL = buf.getChannelData(0);
  const srcR = buf.numberOfChannels > 1 ? buf.getChannelData(1) : srcL;
  const L = new Float32Array(srcL);
  const R = new Float32Array(srcR);

  // 1. DC offset cleanup per channel
  dcOffsetClean(L);
  dcOffsetClean(R);

  onStage("Applying Gain…");
  // 2. Gain to stereo RMS ≈ -9.8 dBFS → computeStats shows ≈ -10.5 LUFS
  const targetRmsLin = Math.pow(10, -9.8 / 20);
  let sumSqL = 0, sumSqR = 0;
  for (let i = 0; i < L.length; i++) { sumSqL += L[i] * L[i]; sumSqR += R[i] * R[i]; }
  const rmsIn = Math.sqrt((sumSqL + sumSqR) / (2 * L.length));
  const gainLin = rmsIn > 1e-9 ? Math.min(targetRmsLin / rmsIn, 6) : 1;
  for (let i = 0; i < L.length; i++) { L[i] *= gainLin; R[i] *= gainLin; }

  onStage("Mastering…");
  // 3. Soft limiting with tanh saturation (-1.0 dBFS ceiling, 76% knee)
  softLimitTanh(L);
  softLimitTanh(R);

  onStage("Encoding…");
  const outBuf = new AudioBuffer({ numberOfChannels: 2, length: buf.length, sampleRate: sr });
  outBuf.getChannelData(0).set(L);
  outBuf.getChannelData(1).set(R);
  const wavBytes = encodeWAV(outBuf);
  const blob = new Blob([wavBytes], { type: "audio/wav" });
  const url = URL.createObjectURL(blob);
  const stats = computeStats(outBuf);
  onStage("Done!");
  return { url, buffer: outBuf, stats };
}

// ── End DJ Andy'K Master functions ─────────────────────────────────────────

async function masterAudio(
  buf: AudioBuffer,
  settings: Settings,
  statsIn: { lufs: number; peak: number; dr: number },
  onStage: (s: string) => void
): Promise<MasterResult> {
  onStage("Analyzing…");
  const sr = buf.sampleRate, ch = buf.numberOfChannels;
  const ctx = new OfflineAudioContext(ch, buf.length, sr);
  const src = ctx.createBufferSource();
  src.buffer = buf;

  let node: AudioNode = src;

  onStage("Applying EQ…");
  if (settings.lowCut) {
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass"; hp.frequency.value = 30; hp.Q.value = 0.7;
    node.connect(hp); node = hp;
  }
  if (settings.autoEQ) {
    // 5-band EQ from eqBands
    const freqs = [60, 250, 1000, 4000, 12000];
    settings.eqBands.forEach((gain, i) => {
      const f = ctx.createBiquadFilter();
      f.type = i === 0 ? "lowshelf" : i === 4 ? "highshelf" : "peaking";
      f.frequency.value = freqs[i]; f.gain.value = gain; f.Q.value = 1;
      node.connect(f); node = f;
    });
  }
  if (settings.highShelf) {
    const hs = ctx.createBiquadFilter();
    hs.type = "highshelf"; hs.frequency.value = 8000; hs.gain.value = 2;
    node.connect(hs); node = hs;
  }
  if (settings.noiseLevel !== "low") {
    const nr = ctx.createBiquadFilter();
    nr.type = "highpass"; nr.frequency.value = NOISE_CUTOFF[settings.noiseLevel]; nr.Q.value = 0.5;
    node.connect(nr); node = nr;
  }

  onStage("Applying Gain…");
  const targetLUFS = PLATFORM_LUFS[settings.platform] + INTENSITY_OFFSET[settings.intensity];
  const gainDb = targetLUFS - statsIn.lufs;
  const gainLin = Math.pow(10, gainDb / 20);
  const gainNode = ctx.createGain();
  gainNode.gain.value = Math.min(gainLin, 6);
  node.connect(gainNode); node = gainNode;
  node.connect(ctx.destination);
  src.start(0);

  onStage("Mastering…");
  const rendered = await ctx.startRendering();

  // True-peak limiting
  const L = rendered.getChannelData(0);
  const R = rendered.numberOfChannels > 1 ? rendered.getChannelData(1) : L;
  const tpLimit = Math.pow(10, (settings.truePeak ?? -0.3) / 20);
  let peak = 0;
  for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const peakScale = peak > tpLimit ? tpLimit / peak : 1;

  // Stereo widening + WAV encode
  onStage("Encoding…");
  const sf = STEREO_FACTOR[settings.stereoWidth];
  const outBuf = new AudioBuffer({ numberOfChannels: 2, length: rendered.length, sampleRate: sr });
  const outL = outBuf.getChannelData(0), outR = outBuf.getChannelData(1);
  for (let i = 0; i < rendered.length; i++) {
    const l = L[i], r = (rendered.numberOfChannels > 1 ? rendered.getChannelData(1)[i] : L[i]);
    const mid = (l + r) / 2, side = ((l - r) / 2) * sf;
    outL[i] = (mid + side) * peakScale;
    outR[i] = (mid - side) * peakScale;
  }

  const wavBytes = encodeWAV(outBuf);
  const blob = new Blob([wavBytes], { type: "audio/wav" });
  const url = URL.createObjectURL(blob);
  const stats = computeStats(outBuf);
  onStage("Done!");
  return { url, buffer: outBuf, stats };
}

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

// ── MP3 encoder ───────────────────────────────────────────────────────────
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

// ── Canvas helpers ─────────────────────────────────────────────────────────
function drawWaveform(canvas: HTMLCanvasElement, buf: AudioBuffer, color: string, progress = 0) {
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
    for (let j = 0; j < step; j++) max = Math.max(max, Math.abs(data[i * step + j] || 0));
    const bh = Math.max(2, max * h * 0.88);
    const x = i * (w / bins), bw = w / bins - 1;
    const played = i / bins < progress;
    ctx.fillStyle = played ? color : color.replace(")", ",0.3)").replace("rgb", "rgba");
    ctx.beginPath();
    (ctx as CanvasRenderingContext2D & { roundRect: (...a: number[]) => void }).roundRect(x, (h - bh) / 2, bw, bh, 1);
    ctx.fill();
  }
}

function drawStereoFan(canvas: HTMLCanvasElement, width: StereoWidth) {
  const ctx = canvas.getContext("2d")!;
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h * 0.88;
  const sf = STEREO_FACTOR[width];
  const maxAngle = Math.min(Math.PI * 0.45, (sf / 1.75) * Math.PI * 0.45);
  const r = Math.min(w, h) * 0.8;
  const numRays = 14;
  for (let i = 0; i <= numRays; i++) {
    const t = i / numRays;
    const angle = -Math.PI / 2 + (t - 0.5) * 2 * maxAngle;
    const fade = Math.cos((t - 0.5) * Math.PI) ** 2;
    const x2 = cx + r * Math.cos(angle), y2 = cy + r * Math.sin(angle);
    const grad = ctx.createLinearGradient(cx, cy, x2, y2);
    grad.addColorStop(0, `rgba(0,0,0,${0.55 * fade})`);
    grad.addColorStop(1, `rgba(0,0,0,0)`);
    ctx.strokeStyle = grad; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x2, y2); ctx.stroke();
  }
  // Arc
  const arcR = r * 0.82;
  const a1 = -Math.PI / 2 - maxAngle, a2 = -Math.PI / 2 + maxAngle;
  ctx.beginPath(); ctx.arc(cx, cy, arcR, a1, a2);
  ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 1.5; ctx.stroke();
  // Center dot
  ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fillStyle = "#111111"; ctx.fill();
  // Width label
  ctx.fillStyle = "rgba(0,0,0,0.8)"; ctx.font = `bold 11px var(--font-mono,monospace)`;
  ctx.textAlign = "center";
  ctx.fillText(`${Math.round(sf * 100)}%`, cx, cy - arcR - 8);
}

function drawSpectrum(canvas: HTMLCanvasElement, level: NoiseLevel) {
  const ctx = canvas.getContext("2d")!;
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const bins = 28;
  const flrRatio = { low: 0.12, medium: 0.28, high: 0.48 }[level];
  const flrH = flrRatio * h * 0.82;
  const bw = Math.max(1, w / bins - 2);
  // Noise floor line
  ctx.setLineDash([3, 3]); ctx.strokeStyle = "rgba(239,68,68,0.42)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, h - flrH); ctx.lineTo(w, h - flrH); ctx.stroke(); ctx.setLineDash([]);
  for (let i = 0; i < bins; i++) {
    const x = i / bins;
    const d1 = x - 0.25, d2 = x - 0.55, d3 = x - 0.8;
    const v = Math.exp(-(d1*d1)/0.06)*0.9 + Math.exp(-(d2*d2)/0.05)*0.65 + Math.exp(-(d3*d3)/0.04)*0.3 + 0.12;
    const maxS = 1.85; // approximate max
    const barH = Math.max(2, (v / maxS) * h * 0.82), y = h - barH;
    const above = barH > flrH;
    const grad = ctx.createLinearGradient(0, y, 0, h);
    grad.addColorStop(0, above ? "rgba(0,0,0,0.8)" : "rgba(239,68,68,0.6)");
    grad.addColorStop(1, above ? "rgba(0,0,0,0.2)" : "rgba(239,68,68,0.2)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    (ctx as CanvasRenderingContext2D & { roundRect: (...a: number[]) => void }).roundRect(i * (w / bins), y, bw, barH, 2);
    ctx.fill();
    ctx.beginPath(); ctx.arc(i * (w / bins) + bw / 2, y, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = above ? "#D9D9D9" : "#ef4444"; ctx.fill();
  }
}

function drawEQ(canvas: HTMLCanvasElement, bands: [number,number,number,number,number]) {
  const ctx = canvas.getContext("2d")!;
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  // Grid
  ctx.strokeStyle = "rgba(0,0,0,0.08)"; ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath(); ctx.moveTo(0, h * i / 4); ctx.lineTo(w, h * i / 4); ctx.stroke();
  }
  // 0dB line
  ctx.strokeStyle = "rgba(0,0,0,0.2)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
  // Freq labels
  const freqLabels = ["60", "250", "1k", "4k", "12k"];
  ctx.fillStyle = "rgba(139,147,168,0.6)"; ctx.font = "9px monospace"; ctx.textAlign = "center";
  const xs = [0.1, 0.3, 0.5, 0.7, 0.9];
  xs.forEach((x, i) => ctx.fillText(freqLabels[i], x * w, h - 4));
  // Curve
  const pts = xs.map((x, i) => ({ x: x * w, y: h / 2 - (bands[i] / 12) * (h * 0.45) }));
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "rgba(0,0,0,0.25)"); grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    const cpx = (pts[i-1].x + pts[i].x) / 2;
    ctx.bezierCurveTo(cpx, pts[i-1].y, cpx, pts[i].y, pts[i].x, pts[i].y);
  }
  ctx.lineTo(w, h / 2);
  ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    const cpx = (pts[i-1].x + pts[i].x) / 2;
    ctx.bezierCurveTo(cpx, pts[i-1].y, cpx, pts[i].y, pts[i].x, pts[i].y);
  }
  ctx.strokeStyle = "#111111"; ctx.lineWidth = 2; ctx.stroke();
  // Handles
  pts.forEach((p, i) => {
    ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#111111"; ctx.fill();
    ctx.strokeStyle = "white"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = "white"; ctx.font = `bold 8px monospace`; ctx.textAlign = "center";
    ctx.fillText(bands[i] >= 0 ? `+${bands[i]}` : `${bands[i]}`, p.x, p.y - 8);
  });
}

function drawLoudnessHistory(canvas: HTMLCanvasElement, history: number[]) {
  const ctx = canvas.getContext("2d")!;
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  if (history.length < 2) return;
  const minL = -30, maxL = 0;
  const toY = (l: number) => h - ((l - minL) / (maxL - minL)) * h * 0.85 - 6;
  // Grid lines
  [-24, -18, -14, -9, -6].forEach(l => {
    const y = toY(l);
    ctx.strokeStyle = l === -14 ? "rgba(0,0,0,0.3)" : "rgba(139,147,168,0.12)";
    ctx.lineWidth = l === -14 ? 1.5 : 1; ctx.setLineDash(l === -14 ? [4, 4] : []);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(139,147,168,0.5)"; ctx.font = "8px monospace"; ctx.textAlign = "right";
    ctx.fillText(`${l}`, w - 2, y - 2);
  });
  const step = w / (history.length - 1);
  const pts = history.map((l, i) => ({ x: i * step, y: toY(l) }));
  // Fill
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "rgba(0,0,0,0.22)"); grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.beginPath();
  ctx.moveTo(0, h); ctx.lineTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    const cpx = (pts[i-1].x + pts[i].x) / 2;
    ctx.bezierCurveTo(cpx, pts[i-1].y, cpx, pts[i].y, pts[i].x, pts[i].y);
  }
  ctx.lineTo(pts[pts.length-1].x, h); ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();
  // Line
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    const cpx = (pts[i-1].x + pts[i].x) / 2;
    ctx.bezierCurveTo(cpx, pts[i-1].y, cpx, pts[i].y, pts[i].x, pts[i].y);
  }
  ctx.strokeStyle = "#111111"; ctx.lineWidth = 2; ctx.stroke();
}

function computeLoudnessHistory(buf: AudioBuffer): number[] {
  const data = buf.getChannelData(0);
  const sr = buf.sampleRate;
  const segLen = Math.floor(sr * 1.5);
  const result: number[] = [];
  for (let i = 0; i + segLen < data.length; i += segLen) {
    let sq = 0;
    for (let j = 0; j < segLen; j++) sq += data[i + j] * data[i + j];
    const rms = Math.sqrt(sq / segLen);
    result.push(Math.round((20 * Math.log10(rms + 1e-9) - 0.691) * 10) / 10);
  }
  return result;
}

// ── Sub-components ─────────────────────────────────────────────────────────
function ToggleSwitch({ label, value, onChange, desc }: { label: string; value: boolean; onChange: (v: boolean) => void; desc?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-foreground)" }}>{label}</div>
        {desc && <div style={{ fontSize: 11, color: "var(--color-muted-2)", marginTop: 1 }}>{desc}</div>}
      </div>
      <button onClick={() => onChange(!value)} className={`toggle-track ${value ? "on" : "off"}`}>
        <div className={`toggle-thumb ${value ? "on" : "off"}`} />
      </button>
    </div>
  );
}

function LevelSelector<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: T[]; label?: string }) {
  const idx = options.indexOf(value);
  const prev = () => idx > 0 && onChange(options[idx - 1]);
  const next = () => idx < options.length - 1 && onChange(options[idx + 1]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-muted-2)" }}>{label}</div>}
      <div className="level-selector">
        <button onClick={prev} className="level-btn" disabled={idx === 0}>−</button>
        <span className="level-label">{value.charAt(0).toUpperCase() + value.slice(1)}</span>
        <button onClick={next} className="level-btn" disabled={idx === options.length - 1}>+</button>
      </div>
    </div>
  );
}

function MiniPlayer({ buffer, url, label, accentColor, isActive, onActivate, stats }: {
  buffer: AudioBuffer; url: string; label: string; accentColor: string;
  isActive: boolean; onActivate: () => void;
  stats: { lufs: number; peak: number; dr: number };
}) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const srcRef = useRef<AudioBufferSourceNode | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const startRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) drawWaveform(canvas, buffer, accentColor, progress);
  }, [buffer, accentColor, progress]);

  const stop = () => {
    srcRef.current?.stop(); srcRef.current = null;
    if (ctxRef.current) { ctxRef.current.close(); ctxRef.current = null; }
    cancelAnimationFrame(rafRef.current);
    setPlaying(false); setProgress(0);
  };

  const toggle = () => {
    if (playing) { stop(); return; }
    onActivate();
    const audioCtx = new AudioContext();
    ctxRef.current = audioCtx;
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    src.connect(audioCtx.destination);
    srcRef.current = src;
    startRef.current = audioCtx.currentTime;
    src.start(0);
    src.onended = () => { setPlaying(false); setProgress(0); };
    setPlaying(true);
    const tick = () => {
      if (!ctxRef.current) return;
      const elapsed = ctxRef.current.currentTime - startRef.current;
      setProgress(elapsed / buffer.duration);
      if (elapsed < buffer.duration) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => { if (!isActive && playing) stop(); }, [isActive]);
  useEffect(() => () => stop(), []);

  return (
    <div style={{ border: `1px solid ${accentColor}33`, borderRadius: 16, padding: "14px 16px", background: `${accentColor}06` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", color: accentColor }}>{label}</span>
        <button onClick={toggle} className={`player-btn ${playing ? "play" : ""}`} style={{ background: playing ? accentColor : `${accentColor}18`, borderColor: `${accentColor}33` }}>
          {playing
            ? <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            : <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
          }
        </button>
      </div>
      <div className="waveform-hit" style={{ background: `${accentColor}08`, height: 52 }}>
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
        <div className="waveform-playhead" style={{ left: `${progress * 100}%`, background: accentColor }} />
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
        {[["LUFS", stats.lufs], ["Peak", stats.peak], ["DR", stats.dr]].map(([k, v]) => (
          <div key={String(k)} style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-muted-2)" }}>{k}</span>
            <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--color-foreground)" }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface MetadataState { title: string; artist: string; album: string; year: string; [key: string]: string; }
function MetadataModal({ metadata, setMetadata, onClose }: {
  metadata: MetadataState;
  setMetadata: (m: MetadataState) => void;
  onClose: () => void;
}) {
  const fields = [
    { key: "title", label: "Title" },
    { key: "artist", label: "Artist" },
    { key: "album", label: "Album" },
    { key: "year", label: "Year" },
  ];
  return (
    <div className="metadata-modal-overlay" onClick={onClose}>
      <div className="glass-card metadata-modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h3 style={{ fontWeight: 700, fontSize: 17, color: "var(--color-foreground)" }}>Edit Metadata</h3>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--color-grid-500)", background: "transparent", color: "var(--color-muted)", cursor: "pointer", fontSize: 16 }}>×</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {fields.map(f => (
            <div key={f.key}>
              <label style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-muted-2)", display: "block", marginBottom: 5 }}>{f.label}</label>
              <input type={f.key === "year" ? "number" : "text"} className="meta-input"
                value={metadata[f.key] || ""} onChange={e => setMetadata({ ...metadata, [f.key]: e.target.value })} />
            </div>
          ))}
        </div>
        <button onClick={onClose}
          style={{ marginTop: 20, width: "100%", padding: "11px", borderRadius: 10, background: "var(--color-deep-teal)", color: "white", fontWeight: 600, fontSize: 14, border: "none", cursor: "pointer" }}>
          Save
        </button>
      </div>
    </div>
  );
}

// ── EQ Visualizer with interactive drag ───────────────────────────────────
function EQVisualizer({ bands, onChange }: { bands: [number,number,number,number,number]; onChange: (b: [number,number,number,number,number]) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragBand = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) drawEQ(canvas, bands);
  }, [bands]);

  const getXS = (w: number) => [0.1, 0.3, 0.5, 0.7, 0.9].map(x => x * w);

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const w = canvas.width;
    const xs = getXS(w);
    dragBand.current = xs.findIndex(x => Math.abs(mx - x) < 18);
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragBand.current === null) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);
    const h = canvas.height;
    const gain = Math.round(((h / 2 - my) / (h * 0.45)) * 12);
    const clamped = Math.max(-12, Math.min(12, gain));
    const nb: [number,number,number,number,number] = [...bands] as [number,number,number,number,number];
    nb[dragBand.current] = clamped;
    onChange(nb);
  };

  const onMouseUp = () => { dragBand.current = null; };

  return (
    <div className="eq-canvas-wrap" style={{ height: 110 }}>
      <canvas ref={canvasRef} width={500} height={110}
        style={{ width: "100%", height: 110, cursor: "ns-resize", display: "block" }}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove}
        onMouseUp={onMouseUp} onMouseLeave={onMouseUp} />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function MasteringClient() {
  // Admin — synchronous init prevents gate flash for admin users
  const [isAdmin] = useState(() => {
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem("andyk_lab_admin") === "true"; } catch { return false; }
  });


  // Batch state
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [batchMode, setBatchMode] = useState(false);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const batchInputRef = useRef<HTMLInputElement>(null);

  // File state
  const [file, setFile] = useState<File | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Track the latest blob URLs in refs so they can be revoked from callbacks/unmount
  // without depending on stale useCallback closures.
  const originalUrlRef = useRef<string | null>(null);
  const resultUrlRef = useRef<string | null>(null);

  // Reference track
  const [refFile, setRefFile] = useState<File | null>(null);
  const [refAnalysis, setRefAnalysis] = useState<Analysis | null>(null);

  // Settings
  const [preset, setPreset] = useState<Preset>("streaming");
  const [intensity, setIntensity] = useState<Intensity>("medium");
  const [stereoWidth, setStereoWidth] = useState<StereoWidth>("standard");
  const [noiseLevel, setNoiseLevel] = useState<NoiseLevel>("medium");
  const [autoEQ, setAutoEQ] = useState(true);
  const [lowCut, setLowCut] = useState(false);
  const [highShelf, setHighShelf] = useState(false);
  const [limiter, setLimiter] = useState(true);
  const [platform, setPlatform] = useState<Platform>("spotify");
  const [eqBands, setEqBands] = useState<[number,number,number,number,number]>([0,0,0,0,0]);

  // Processing
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MasterResult | null>(null);
  const [loudnessHistory, setLoudnessHistory] = useState<number[]>([]);

  // Playback
  const [mainPlaying, setMainPlaying] = useState(false);
  const [mainProgress, setMainProgress] = useState(0);
  const [mainTime, setMainTime] = useState(0);
  const [activePlayer, setActivePlayer] = useState<"main"|"before"|"after"|null>(null);

  // UI
  const [showMetadata, setShowMetadata] = useState(false);
  const [metadata, setMetadata] = useState<MetadataState>({ title: "", artist: "", album: "", year: "" });

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const stereoCanvasRef = useRef<HTMLCanvasElement>(null);
  const noiseCanvasRef = useRef<HTMLCanvasElement>(null);
  const loudHistRef = useRef<HTMLCanvasElement>(null);
  const mainSrcRef = useRef<AudioBufferSourceNode | null>(null);
  const mainCtxRef = useRef<AudioContext | null>(null);
  const mainStartRef = useRef(0);
  const rafRef = useRef(0);

  const targetLUFS = PLATFORM_LUFS[platform] + INTENSITY_OFFSET[intensity];

  const applyPreset = (p: Preset) => {
    setPreset(p);
    if (p === "custom" || p === "djandyk_master") return;
    const s = PRESETS[p];
    setIntensity(s.intensity); setStereoWidth(s.stereoWidth); setNoiseLevel(s.noiseLevel);
    setAutoEQ(s.autoEQ); setLowCut(s.lowCut); setHighShelf(s.highShelf); setLimiter(s.limiter);
    setPlatform(s.platform); setEqBands(s.eqBands);
  };

  const markCustom = () => setPreset("custom");

  // Canvases
  useEffect(() => {
    if (audioBuffer && mainCanvasRef.current) drawWaveform(mainCanvasRef.current, audioBuffer, "rgb(17,17,17)", mainProgress);
  }, [audioBuffer, mainProgress]);

  useEffect(() => {
    if (stereoCanvasRef.current) drawStereoFan(stereoCanvasRef.current, stereoWidth);
  }, [stereoWidth]);

  useEffect(() => {
    if (noiseCanvasRef.current) drawSpectrum(noiseCanvasRef.current, noiseLevel);
  }, [noiseLevel]);

  useEffect(() => {
    if (loudHistRef.current && loudnessHistory.length > 0) drawLoudnessHistory(loudHistRef.current, loudnessHistory);
  }, [loudnessHistory]);

  const stopMain = useCallback(() => {
    mainSrcRef.current?.stop(); mainSrcRef.current = null;
    if (mainCtxRef.current) { mainCtxRef.current.close(); mainCtxRef.current = null; }
    cancelAnimationFrame(rafRef.current);
    setMainPlaying(false); setMainProgress(0); setMainTime(0);
  }, []);

  const toggleMain = useCallback(() => {
    if (!audioBuffer) return;
    if (mainPlaying) { stopMain(); return; }
    setActivePlayer("main");
    const audioCtx = new AudioContext();
    mainCtxRef.current = audioCtx;
    const src = audioCtx.createBufferSource();
    src.buffer = audioBuffer; src.connect(audioCtx.destination);
    mainSrcRef.current = src; mainStartRef.current = audioCtx.currentTime;
    src.start(0); src.onended = () => { setMainPlaying(false); setMainProgress(0); setMainTime(0); };
    setMainPlaying(true);
    const tick = () => {
      if (!mainCtxRef.current) return;
      const el = mainCtxRef.current.currentTime - mainStartRef.current;
      setMainProgress(el / audioBuffer.duration);
      setMainTime(el);
      if (el < audioBuffer.duration) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [audioBuffer, mainPlaying, stopMain]);

  const seekMain = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioBuffer || !mainCanvasRef.current) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    stopMain(); setMainProgress(pct); setMainTime(pct * audioBuffer.duration);
  };

  const fmt = (s: number) => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`;

  // Revoke any blob URLs still outstanding when the tool unmounts (e.g. navigating away).
  useEffect(() => () => {
    if (originalUrlRef.current) URL.revokeObjectURL(originalUrlRef.current);
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
  }, []);

  const handleFile = useCallback(async (f: File) => {
    if (!f.type.match(/audio\//) && !f.name.match(/\.(mp3|wav|flac|ogg|aac)$/i)) {
      setError("Please upload an MP3 or WAV file."); return;
    }
    if (f.size > MAX_FILE_BYTES) {
      setError("File is too large (max 250MB). Please upload a smaller file."); return;
    }
    setLoadingAudio(true); setError(null); setResult(null); setAnalysis(null);
    if (resultUrlRef.current) { URL.revokeObjectURL(resultUrlRef.current); resultUrlRef.current = null; }
    try {
      const ab = await f.arrayBuffer();
      const audioCtx = new AudioContext();
      const buffer = await audioCtx.decodeAudioData(ab);
      await audioCtx.close();
      if (originalUrlRef.current) URL.revokeObjectURL(originalUrlRef.current);
      const url = URL.createObjectURL(new Blob([ab], { type: f.type }));
      originalUrlRef.current = url;
      setFile(f); setAudioBuffer(buffer); setOriginalUrl(url);
      setMetadata((m: MetadataState) => ({ ...m, title: f.name.replace(/\.[^.]+$/, "") }));
      const hist = computeLoudnessHistory(buffer);
      setLoudnessHistory(hist);
      const ana = await analyzeBuffer(buffer, isAdmin);
      setAnalysis(ana);
    } catch {
      setError("Failed to decode audio. Please try an MP3 or WAV.");
    } finally {
      setLoadingAudio(false);
    }
  }, [isAdmin]);

  const handleRefFile = useCallback(async (f: File) => {
    try {
      const ab = await f.arrayBuffer();
      const audioCtx = new AudioContext();
      const buffer = await audioCtx.decodeAudioData(ab);
      await audioCtx.close();
      setRefFile(f);
      const ana = await analyzeBuffer(buffer, isAdmin);
      setRefAnalysis(ana);
    } catch { /* ignore ref errors */ }
  }, [isAdmin]);

  const doMaster = async () => {
    if (!audioBuffer || !analysis) return;
    setError(null); setResult(null);
    if (resultUrlRef.current) { URL.revokeObjectURL(resultUrlRef.current); resultUrlRef.current = null; }
    try {
      let r: MasterResult;
      if (preset === "djandyk_master") {
        r = await masterAudioDjAndyK(audioBuffer, setStage);
      } else {
        const settings: Settings = { intensity, stereoWidth, noiseLevel, autoEQ, lowCut, highShelf, limiter, platform, eqBands };
        r = await masterAudio(audioBuffer, settings, { lufs: analysis.lufs, peak: analysis.peak, dr: analysis.dr }, setStage);
      }
      resultUrlRef.current = r.url;
      setResult(r);
      const hist = computeLoudnessHistory(r.buffer);
      setLoudnessHistory(hist);
    } catch (err) {
      console.error(err);
      setError("Mastering failed. Please try again.");
    } finally {
      setStage(null);
    }
  };

  const download = () => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.url;
    a.download = `${metadata.title || "mastered"}_master.wav`;
    a.click();
  };

  const downloadMp3 = (kbps: 192 | 320) => {
    if (!result) return;
    const blob = encodeMp3(result.buffer, kbps);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${metadata.title || "mastered"}_master_${kbps}k.mp3`;
    a.click(); setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const generatePdf = () => {
    if (!result || !analysis) return;
    const win = window.open("", "_blank")!;
    const baseName = metadata.title || file?.name?.replace(/\.[^.]+$/, "") || "track";
    win.document.write(`<!DOCTYPE html><html><head><title>Mastering Report — ${baseName}</title>
<style>body{font-family:'IBM Plex Mono',monospace;color:#111;background:#fff;padding:48px;max-width:600px;margin:0 auto}
h1{font-size:22px;font-weight:800;letter-spacing:-0.02em;margin:0 0 4px}
.sub{font-size:10px;text-transform:uppercase;letter-spacing:0.15em;color:#a3a3a3;margin:0 0 32px}
table{width:100%;border-collapse:collapse;margin:0 0 24px}
td{padding:10px 0;border-bottom:1px solid #e5e5e5;font-size:13px}
td:first-child{color:#a3a3a3;width:180px}
td:last-child{font-weight:600}
.footer{font-size:10px;color:#a3a3a3;text-transform:uppercase;letter-spacing:0.1em;border-top:1px solid #e5e5e5;padding-top:16px;margin-top:32px}
@media print{button{display:none}}</style></head><body>
<h1>Mastering Report</h1>
<div class="sub">Andy&apos;K Music Lab &nbsp;·&nbsp; ${new Date().toLocaleDateString("en-GB",{dateStyle:"medium"})}</div>
<table>
<tr><td>Filename</td><td>${baseName}</td></tr>
<tr><td>Preset</td><td>${preset}</td></tr>
<tr><td>Platform target</td><td>${platform} / ${PLATFORM_LUFS[platform]} LUFS</td></tr>
<tr><td>BPM</td><td>${analysis.bpm}</td></tr>
<tr><td>Key</td><td>${analysis.keyNote} ${analysis.keyMode}</td></tr>
<tr><td>LUFS before</td><td>${analysis.lufs} LUFS</td></tr>
<tr><td>LUFS after</td><td>${result.stats.lufs} LUFS</td></tr>
<tr><td>Peak before</td><td>${analysis.peak} dBFS</td></tr>
<tr><td>Peak after</td><td>${result.stats.peak} dBFS</td></tr>
<tr><td>Dynamic range</td><td>${result.stats.dr} dB DR</td></tr>
</table>
<div class="footer">&copy; 2026 ANDY&apos;K GROUP INTERNATIONAL LTD &nbsp;·&nbsp; lab.djandykofficial.com</div>
<button onclick="window.print()" style="margin-top:24px;padding:12px 24px;background:#111;color:#fff;border:none;cursor:pointer;font-size:13px">Print / Save PDF</button>
</body></html>`);
    win.document.close();
  };

  const runBatch = async () => {
    if (batchFiles.length === 0) return;
    setBatchProcessing(true); setBatchProgress(0);
    const zip = new JSZip();
    const settings: Settings = { intensity, stereoWidth, noiseLevel, autoEQ, lowCut, highShelf, limiter, platform, eqBands };
    for (let i = 0; i < batchFiles.length; i++) {
      const f = batchFiles[i];
      try {
        const ab = await f.arrayBuffer();
        const audioCtx = new AudioContext();
        const buf = await audioCtx.decodeAudioData(ab);
        await audioCtx.close();
        const ana = await analyzeBuffer(buf, isAdmin);
        const r = preset === "djandyk_master"
          ? await masterAudioDjAndyK(buf, () => {})
          : await masterAudio(buf, settings, { lufs: ana.lufs, peak: ana.peak, dr: ana.dr }, () => {});
        const wavBytes = encodeWAV(r.buffer);
        zip.file(`${f.name.replace(/\.[^.]+$/, "")}_master.wav`, wavBytes);
      } catch { /* skip failed file */ }
      setBatchProgress(Math.round(((i + 1) / batchFiles.length) * 100));
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "andyk_masters.zip"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    setBatchProcessing(false); setBatchProgress(0);
  };

  useEffect(() => {
    if (activePlayer !== "main" && mainPlaying) stopMain();
  }, [activePlayer]);

  return (
    <div className="tool-page-bg">
      <div className="max-w-5xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="tool-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <rect x="2" y="9" width="3.5" height="12" rx="1.75" opacity="0.45"/>
                <rect x="7.5" y="4" width="3.5" height="17" rx="1.75"/>
                <rect x="13" y="7" width="3.5" height="14" rx="1.75" opacity="0.78"/>
                <rect x="18.5" y="2" width="3.5" height="19" rx="1.75" opacity="0.55"/>
              </svg>
            </div>
            <h1 style={{ fontSize: "clamp(1.5rem,3vw,2rem)", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--color-foreground)", lineHeight: 1.1 }}>
              <span className="head-word-serif serif-accent">Mastering</span>{" "}
              <span className="head-word-bold">Tool</span>
            </h1>
            <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 100, background: isAdmin ? "#111111" : "var(--color-soft-green)", color: isAdmin ? "#ffffff" : "var(--color-deep-teal)", fontWeight: 700, flexShrink: 0 }}>{isAdmin ? "Admin ✓" : "Demo Free"}</span>
          </div>
          <p style={{ fontSize: 14, color: "var(--color-muted)", lineHeight: 1.65, maxWidth: 540 }}>
            Upload your track. Choose a preset. Master to streaming standards with EQ, stereo widening, and true-peak limiting — in your browser.
          </p>
        </div>

        {/* Mode toggle */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button onClick={() => setBatchMode(false)} style={{ padding: "7px 16px", borderRadius: 9, border: `1px solid ${!batchMode?"#111111":"var(--color-grid-500)"}`, background: !batchMode?"#111111":"transparent", color: !batchMode?"#ffffff":"var(--color-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Single Track</button>
          <button onClick={() => setBatchMode(true)}  style={{ padding: "7px 16px", borderRadius: 9, border: `1px solid ${batchMode?"#111111":"var(--color-grid-500)"}`,  background: batchMode?"#111111":"transparent",  color: batchMode?"#ffffff":"var(--color-muted)",  fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Batch (up to 5)</button>
        </div>

        {/* Batch mode UI */}
        {batchMode && (
          <div className="glass-card rounded-2xl p-5 mb-6">
            <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-muted-2)", marginBottom: 12 }}>Batch Mastering</div>
            <input ref={batchInputRef} type="file" accept="audio/*,.mp3,.wav" multiple className="hidden"
              onChange={e => { const files = Array.from(e.target.files || []).slice(0, 5); setBatchFiles(files); }} />
            <div className="upload-zone rounded-xl p-6 flex flex-col items-center text-center cursor-pointer mb-4" onClick={() => batchInputRef.current?.click()}>
              {batchFiles.length > 0 ? (
                <div style={{ width: "100%", textAlign: "left" }}>
                  {batchFiles.map((f, i) => <div key={i} style={{ fontSize: 12, color: "var(--color-foreground)", padding: "4px 0", borderBottom: "1px solid var(--color-grid-500)" }}>{i+1}. {f.name}</div>)}
                  <div style={{ fontSize: 11, color: "var(--color-muted-2)", marginTop: 8 }}>Click to change selection</div>
                </div>
              ) : (
                <>
                  <p style={{ fontWeight: 600, color: "var(--color-foreground)" }}>Select up to 5 audio files</p>
                  <p style={{ fontSize: 12, color: "var(--color-muted-2)" }}>Each will be mastered with current settings</p>
                </>
              )}
            </div>
            {batchProcessing ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0" }}>
                <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid #111111", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#111111" }}>Processing… {batchProgress}%</span>
                <div style={{ flex: 1, height: 4, borderRadius: 2, background: "var(--color-grid-500)" }}>
                  <div style={{ height: "100%", width: `${batchProgress}%`, background: "#111111", borderRadius: 2, transition: "width 0.3s ease" }} />
                </div>
              </div>
            ) : (
              <button onClick={runBatch} disabled={batchFiles.length === 0} className="download-btn" style={{ width: "100%", justifyContent: "center", opacity: batchFiles.length===0?0.5:1 }}>
                Master All & Download ZIP
              </button>
            )}
          </div>
        )}

        {/* Upload */}
        {!batchMode && !audioBuffer ? (
          <>
          <div
            className={`upload-zone rounded-2xl p-12 flex flex-col items-center justify-center text-center cursor-pointer mb-4 ${dragOver ? "drag-over" : ""}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            onClick={() => inputRef.current?.click()}
          >
            <input ref={inputRef} type="file" accept="audio/*,.mp3,.wav" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            {loadingAudio ? (
              <div style={{ color: "#111111", fontWeight: 600 }}>Loading audio…</div>
            ) : (
              <>
                <div style={{ width: 64, height: 64, borderRadius: 18, background: "var(--color-soft-green)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-deep-teal)" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                </div>
                <p style={{ fontWeight: 700, color: "var(--color-foreground)", fontSize: 16, marginBottom: 6 }}>Drop your MP3 or WAV here</p>
                <p style={{ fontSize: 13, color: "var(--color-muted-2)" }}>or click to browse · processed locally, no upload</p>
              </>
            )}
          </div>
          <HowItWorks
            title="How Mastering Works"
            steps={MASTERING_STEPS}
            privacyNote="Your audio never leaves your browser. All processing runs locally via the Web Audio API."
          />
          </>
        ) : !batchMode ? (
          <>
            {/* ── Full-width Waveform Player ── */}
            <div className="waveform-player mb-6">
              <div className="waveform-hit waveform-main" style={{ height: 88, borderRadius: 0, padding: "8px 16px" }}
                onClick={seekMain}>
                <canvas ref={mainCanvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
                <div className="waveform-playhead" style={{ left: `calc(${mainProgress*100}% + 14px)`, background: "#111111" }} />
              </div>
              <div className="player-controls">
                <button onClick={() => { stopMain(); setMainProgress(Math.max(0, mainProgress - 10/audioBuffer!.duration)); }} className="player-btn">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="19,20 9,12 19,4"/><line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" strokeWidth="3"/></svg>
                </button>
                <button onClick={toggleMain} className="player-btn play">
                  {mainPlaying
                    ? <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                    : <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>}
                </button>
                <button onClick={() => { stopMain(); setMainProgress(Math.min(1, mainProgress + 10/audioBuffer!.duration)); }} className="player-btn">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,4 15,12 5,20"/><line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="3"/></svg>
                </button>
                <span className="player-time">{fmt(mainTime)} / {fmt(audioBuffer!.duration)}</span>
                <div style={{ flex: 1 }} />
                <button onClick={() => {
                  if (originalUrlRef.current) { URL.revokeObjectURL(originalUrlRef.current); originalUrlRef.current = null; }
                  if (resultUrlRef.current) { URL.revokeObjectURL(resultUrlRef.current); resultUrlRef.current = null; }
                  setAudioBuffer(null); setFile(null); setOriginalUrl(null); setAnalysis(null); setResult(null); stopMain();
                }}
                  style={{ fontSize: 12, color: "var(--color-muted-2)", background: "none", border: "none", cursor: "pointer" }}>
                  ✕ Remove
                </button>
              </div>
              {analysis && (
                <div className="player-info-bar">
                  {[
                    ["Pitch", `${analysis.pitch} Hz`],
                    ["BPM", analysis.bpm],
                    ["Key", `${analysis.keyNote} ${analysis.keyMode}`],
                    ["Dance", `${analysis.danceability}%`],
                    ["LUFS", analysis.lufs],
                  ].map(([k, v]) => (
                    <div key={String(k)} className="player-info-item">
                      <span className="player-info-label">{k}</span>
                      <span className="player-info-value">{v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Presets ── */}
            <div className="glass-card rounded-2xl p-5 mb-4">
              <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-muted-2)", marginBottom: 12 }}>Preset Styles</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(["club", "radio", "streaming", "vinyl", "halsey", "djandyk_master", "custom"] as Preset[]).map(p => (
                  <button key={p} className={`preset-btn ${preset === p ? "active" : ""}`} onClick={() => applyPreset(p)}>
                    {p === "djandyk_master" ? (
                      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                        <span>DJ Andy&apos;K Master</span>
                        <span style={{ fontSize: 9, opacity: 0.65, fontWeight: 400, letterSpacing: 0 }}>−10.5 LUFS / −1.0 dBFS soft-limited, no EQ</span>
                      </span>
                    ) : p === "halsey" ? "Halsey / Vocal Pop" : p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Settings cards ── */}
            <div className="grid md:grid-cols-3 gap-4 mb-4">
              {/* Intensity */}
              <div className="glass-card rounded-2xl p-5">
                <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-muted-2)", marginBottom: 14 }}>Mastering Intensity</div>
                <div style={{ fontSize: 32, fontWeight: 800, fontFamily: "var(--font-mono)", color: "#111111", marginBottom: 4 }}>{targetLUFS}</div>
                <div style={{ fontSize: 11, color: "var(--color-muted-2)", marginBottom: 14 }}>Target LUFS</div>
                <LevelSelector value={intensity} onChange={v => { setIntensity(v); markCustom(); }} options={["low","medium","high"]} />
              </div>

              {/* Stereo */}
              <div className="glass-card rounded-2xl p-5">
                <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-muted-2)", marginBottom: 10 }}>Stereo Widening</div>
                <canvas ref={stereoCanvasRef} width={200} height={90} style={{ width: "100%", height: 90, display: "block", marginBottom: 10 }} />
                <LevelSelector value={stereoWidth} onChange={v => { setStereoWidth(v); markCustom(); }} options={["narrow","standard","wide"]} />
              </div>

              {/* Noise */}
              <div className="glass-card rounded-2xl p-5">
                <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-muted-2)", marginBottom: 10 }}>Noise Reduction</div>
                <canvas ref={noiseCanvasRef} width={200} height={90} style={{ width: "100%", height: 90, display: "block", marginBottom: 10 }} />
                <LevelSelector value={noiseLevel} onChange={v => { setNoiseLevel(v); markCustom(); }} options={["low","medium","high"]} />
              </div>
            </div>

            {/* ── Toggles + Platform ── */}
            <div className="glass-card rounded-2xl p-5 mb-4">
              <div className="grid md:grid-cols-2 gap-x-8 gap-y-4 mb-5">
                <ToggleSwitch label="Auto EQ" value={autoEQ} onChange={v => { setAutoEQ(v); markCustom(); }} desc="Frequency-adaptive equalisation" />
                <ToggleSwitch label="Low-cut Filter" value={lowCut} onChange={v => { setLowCut(v); markCustom(); }} desc="Remove sub-bass below 30 Hz" />
                <ToggleSwitch label="High-shelf Boost" value={highShelf} onChange={v => { setHighShelf(v); markCustom(); }} desc="+2 dB presence above 8 kHz" />
                <ToggleSwitch label="Limiter −0.3 dBTP" value={limiter} onChange={v => { setLimiter(v); markCustom(); }} desc="True-peak ceiling protection" />
              </div>
              <div className="tron-line" style={{ marginBottom: 16 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-muted-2)" }}>Target Platform</span>
                {(["spotify","apple","youtube"] as Platform[]).map(p => (
                  <button key={p} className={`platform-btn ${platform === p ? "active" : ""}`}
                    onClick={() => { setPlatform(p); markCustom(); }}>
                    {p === "spotify" ? "Spotify −14" : p === "apple" ? "Apple −16" : "YouTube −14"}
                  </button>
                ))}
              </div>
            </div>

            {/* ── EQ Visualizer ── */}
            {autoEQ && (
              <div className="glass-card rounded-2xl p-5 mb-4">
                <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-muted-2)", marginBottom: 10 }}>
                  EQ Curve <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: 10 }}>— drag handles to adjust ±12 dB</span>
                </div>
                <EQVisualizer bands={eqBands} onChange={b => { setEqBands(b); markCustom(); }} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                  {["60 Hz","250 Hz","1 kHz","4 kHz","12 kHz"].map((f,i) => (
                    <span key={i} style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--color-muted-2)", textAlign: "center", width: "20%" }}>{f}</span>
                  ))}
                </div>
              </div>
            )}

            {/* ── Reference Track ── */}
            <div className="glass-card rounded-2xl p-5 mb-4">
              <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-muted-2)", marginBottom: 10 }}>Reference Track</div>
              <div className={`ref-track-zone ${refFile ? "active" : ""}`} onClick={() => refInputRef.current?.click()}>
                <input ref={refInputRef} type="file" accept="audio/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleRefFile(f); }} />
                {refFile && refAnalysis ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--color-foreground)" }}>{refFile.name.replace(/\.[^.]+$/,"")}</div>
                      <div style={{ fontSize: 11, color: "var(--color-muted-2)", marginTop: 2, fontFamily: "var(--font-mono)" }}>
                        LUFS {refAnalysis.lufs} · {refAnalysis.keyNote} {refAnalysis.keyMode} · {refAnalysis.bpm} BPM
                      </div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); setRefFile(null); setRefAnalysis(null); }}
                      style={{ fontSize: 12, color: "var(--color-muted-2)", background: "none", border: "none", cursor: "pointer" }}>✕</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-muted-2)" strokeWidth="1.8" strokeLinecap="round">
                      <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                    </svg>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-muted)" }}>Upload a reference track</div>
                      <div style={{ fontSize: 11, color: "var(--color-muted-2)" }}>Master will match its loudness signature</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Loudness History ── */}
            {loudnessHistory.length > 2 && (
              <div className="glass-card rounded-2xl p-5 mb-4">
                <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-muted-2)", marginBottom: 10 }}>
                  Loudness Profile {result ? "— Mastered" : "— Original"}
                </div>
                <div className="loudness-graph-wrap" style={{ padding: 0 }}>
                  <canvas ref={loudHistRef} width={600} height={90} style={{ width: "100%", height: 90, display: "block" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--color-muted-2)" }}>0:00</span>
                  <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "rgba(0,0,0,0.7)" }}>—14 LUFS (Spotify)</span>
                  <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--color-muted-2)" }}>{fmt(audioBuffer!.duration)}</span>
                </div>
              </div>
            )}

            {/* ── Processing button ── */}
            <div className="mb-6">
              {error && (
                <div style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", fontSize: 13, color: "#ef4444", marginBottom: 12 }}>
                  {error}
                </div>
              )}
              {stage ? (
                <div style={{ padding: "16px", borderRadius: 14, background: "rgba(0,0,0,0.08)", border: "1px solid rgba(0,0,0,0.2)", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid #111111", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
                  <span style={{ fontWeight: 600, color: "#111111" }}>{stage}</span>
                  <div style={{ flex: 1, height: 4, borderRadius: 2, background: "var(--color-grid-500)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: stage === "Done!" ? "100%" : stage === "Encoding…" ? "80%" : stage === "Mastering…" ? "60%" : stage === "Applying Gain…" ? "45%" : stage === "Applying EQ…" ? "30%" : "15%", background: "#111111", borderRadius: 2, transition: "width 0.4s ease" }} />
                  </div>
                </div>
              ) : (
                <button onClick={doMaster} className="download-btn" style={{ width: "100%", justifyContent: "center", fontSize: 16 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="2" y="9" width="3.5" height="12" rx="1.75" opacity="0.45"/>
                    <rect x="7.5" y="4" width="3.5" height="17" rx="1.75"/>
                    <rect x="13" y="7" width="3.5" height="14" rx="1.75" opacity="0.78"/>
                    <rect x="18.5" y="2" width="3.5" height="19" rx="1.75" opacity="0.55"/>
                  </svg>
                  Master Track
                </button>
              )}
            </div>

            {/* ── Before / After ── */}
            {result && audioBuffer && originalUrl && (
              <div className="glass-card rounded-2xl p-5 mb-4 animate-fade-up">
                <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-muted-2)", marginBottom: 14 }}>
                  Before / After Comparison
                </div>
                <div className="grid md:grid-cols-2 gap-4 mb-5">
                  <MiniPlayer buffer={audioBuffer} url={originalUrl} label="ORIGINAL" accentColor="rgb(99,130,154)"
                    isActive={activePlayer === "before"} onActivate={() => setActivePlayer("before")}
                    stats={{ lufs: analysis!.lufs, peak: analysis!.peak, dr: analysis!.dr }} />
                  <MiniPlayer buffer={result.buffer} url={result.url} label="MASTERED" accentColor="rgb(17,17,17)"
                    isActive={activePlayer === "after"} onActivate={() => setActivePlayer("after")}
                    stats={result.stats} />
                </div>
                {/* Stats table */}
                <div className="stats-table">
                  <div className="stats-table-head">
                    <span>Metric</span><span>Original</span><span>Mastered</span>
                  </div>
                  {[
                    { label: "LUFS", orig: analysis!.lufs, master: result.stats.lufs, unit: "" },
                    { label: "Peak dBFS", orig: analysis!.peak, master: result.stats.peak, unit: "" },
                    { label: "Dyn. Range", orig: analysis!.dr, master: result.stats.dr, unit: " dB" },
                  ].map(row => (
                    <div key={row.label} className="stats-table-row">
                      <span style={{ color: "var(--color-muted)", fontSize: 13 }}>{row.label}</span>
                      <span className="stats-val">{row.orig}{row.unit}</span>
                      <span className={`stats-val improved`}>{row.master}{row.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Download ── */}
            {result && (
              <div className="glass-card rounded-2xl p-5 animate-fade-up">
                <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-muted-2)", marginBottom: 14 }}>Download</div>
                <div style={{ fontSize: 12, color: "var(--color-muted-2)", fontFamily: "var(--font-mono)", marginBottom: 14 }}>
                  {metadata.title || file?.name?.replace(/\.[^.]+$/,"") || "master"}_master
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button onClick={download} className="download-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    WAV
                  </button>
                  <button onClick={() => downloadMp3(192)} className="download-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    MP3 192k
                  </button>
                  <button onClick={() => downloadMp3(320)} className="download-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    MP3 320k
                  </button>
                  <button onClick={generatePdf}
                    style={{ padding: "13px 18px", borderRadius: 14, border: "1px solid var(--color-grid-500)", background: "transparent", color: "var(--color-muted)", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                    PDF Report
                  </button>
                  <button onClick={() => setShowMetadata(true)}
                    style={{ padding: "13px 18px", borderRadius: 14, border: "1px solid var(--color-grid-500)", background: "transparent", color: "var(--color-muted)", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Metadata
                  </button>
                </div>
              </div>
            )}
          </>
        ) : null}

        {showMetadata && (
          <MetadataModal metadata={metadata} setMetadata={setMetadata} onClose={() => setShowMetadata(false)} />
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
