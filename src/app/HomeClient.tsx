"use client";

import Image from "next/image";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import ScrollReveal from "@/components/ScrollReveal";
import WaitlistForm, { type WaitlistPlan } from "@/components/WaitlistForm";
import { CURRENCIES, type Currency, convert } from "@/lib/currency";
import { useLanguage } from "@/context/LanguageContext";

// ── SVG Icons ────────────────────────────────────────────────────────────────

const IconUpload = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);
const IconProcess = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3"/>
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
  </svg>
);
const IconDownload = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);
const IconEqualizer = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <rect x="2" y="9" width="3.5" height="12" rx="1.75" opacity="0.45"/>
    <rect x="2" y="5" width="3.5" height="3.5" rx="1.75" opacity="0.45"/>
    <rect x="7.5" y="4" width="3.5" height="17" rx="1.75"/>
    <rect x="13" y="7" width="3.5" height="14" rx="1.75" opacity="0.78"/>
    <rect x="18.5" y="2" width="3.5" height="19" rx="1.75" opacity="0.55"/>
  </svg>
);
const IconPulse = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="2,12 5,12 7,5 9,19 11,9 13,15 15,11 17,13 19,12 22,12"/>
  </svg>
);
const IconVinyl = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/>
    <circle cx="12" cy="12" r="5.5"/>
    <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none"/>
    <path d="M12 6.5 A5.5 5.5 0 0 1 17.5 12"/>
  </svg>
);
const IconScales = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/>
    <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/>
    <path d="M7 21h10"/>
    <path d="M12 3v18"/>
    <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>
  </svg>
);
const IconMusic = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 18V5l12-2v13"/>
    <circle cx="6" cy="18" r="3"/>
    <circle cx="18" cy="16" r="3"/>
  </svg>
);
const IconMetronome = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="12 3 22 21 2 21"/>
    <line x1="12" y1="8" x2="17" y2="17"/>
    <line x1="8.5" y1="14" x2="15.5" y2="14"/>
  </svg>
);
const IconVolume = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
  </svg>
);
const IconLayers = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="12 2 2 7 12 12 22 7 12 2"/>
    <polyline points="2 17 12 22 22 17"/>
    <polyline points="2 12 12 17 22 12"/>
  </svg>
);
const IconArrow = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
);
const IconCPU = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
    <rect x="4" y="4" width="16" height="16" rx="2"/>
    <rect x="9" y="9" width="6" height="6"/>
    <line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/>
    <line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/>
    <line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/>
    <line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>
  </svg>
);
const IconLock = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);
const IconCheck = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

// ── Waveform ──────────────────────────────────────────────────────────────────

const WAVE_HEIGHTS = [
  16, 24, 36, 52, 65, 72, 60, 78, 70, 55, 80, 72, 64, 76, 58, 82, 74, 66,
  88, 78, 90, 82, 76, 92, 88, 80, 92, 84, 78, 88, 82, 72, 86, 76, 66, 80,
  70, 60, 74, 62, 52, 68, 56, 44, 58, 40, 28, 18,
];

function HeroWaveform() {
  return (
    <div className="hero-waveform" aria-hidden="true">
      {WAVE_HEIGHTS.map((h, i) => (
        <div key={i} className="hero-wave-bar" style={{ height: `${h}px`, animationDelay: `${((i * 0.075) % 1.8).toFixed(2)}s` }} />
      ))}
    </div>
  );
}

// ── AB heading helper ─────────────────────────────────────────────────────────

function AltHead({ children }: { children: string }) {
  const words = children.split(" ");
  return (
    <>
      {words.map((w, i) => (
        <span key={i}>
          {i > 0 && " "}
          {i % 2 === 0
            ? <span className="head-word-serif serif-accent">{w}</span>
            : <span className="head-word-bold">{w}</span>}
        </span>
      ))}
    </>
  );
}

// ── Static data ───────────────────────────────────────────────────────────────

const steps = [
  { num: "01", icon: <IconUpload />, title: "Upload Your Track", desc: "Drop your MP3 or WAV. Your audio stays entirely in your browser — 100% private, never sent to any server." },
  { num: "02", icon: <IconProcess />, title: "Smart Audio Processing", desc: "Browser-based DSP engine analyses loudness, applies precision EQ, and masters to industry standards in seconds." },
  { num: "03", icon: <IconDownload />, title: "Compare & Download", desc: "Hear the A/B difference, review LUFS stats, and download your mastered WAV — all within your browser." },
];

const tools: { href: string; icon: React.ReactNode; title: string; desc: string; plan: WaitlistPlan }[] = [
  { href: "/mastering", icon: <IconEqualizer />, title: "Mastering Tool",    plan: "single",  desc: "Normalize to -14 LUFS (Spotify standard), apply EQ, stereo widening, and limit to -0.3 dBTP. Includes A/B waveform compare, presets, and reference track analysis." },
  { href: "/bpm",      icon: <IconPulse />,     title: "BPM + Key Detector", plan: "studio", desc: "Instant BPM via autocorrelation, musical key via Krumhansl-Schmuckler, Camelot wheel, Tap BPM, danceability score, and analysis history." },
  { href: "/planner",          icon: <IconVinyl />,    title: "DJ Set Planner",     plan: "studio", desc: "Drag & drop tracks, auto-sort by Camelot key, visualise energy flow, see transition quality labels, and export your set." },
  { href: "/track-comparator", icon: <IconScales />,   title: "Track Comparator",   plan: "studio", desc: "Upload two tracks and compare waveforms, LUFS levels, and frequency content side-by-side. Spot the mix differences instantly." },
  { href: "/chord-generator",  icon: <IconMusic />,    title: "Chord Generator",    plan: "studio", desc: "Generate chord progressions in any key, explore voicings, and preview how chords sound together — built for producers and songwriters." },
  { href: "/metronome",        icon: <IconMetronome />,title: "Metronome",          plan: "studio", desc: "Precision browser metronome with adjustable BPM, time signatures, accent patterns, and tap tempo — zero latency via Web Audio API." },
  { href: "/loudness-meter",   icon: <IconVolume />,   title: "Loudness Meter",     plan: "studio", desc: "Real-time LUFS, RMS, and true-peak metering in your browser. Measure loudness against Spotify, Apple Music, and YouTube targets." },
  { href: "/stem-splitter",    icon: <IconLayers />,   title: "Stem Splitter",      plan: "pro",    desc: "Separate vocals, drums, bass, and other stems from any track — entirely in the browser. No uploads, no servers, complete privacy." },
];

const stats = [
  { icon: <IconCPU />,   value: "Web Audio API",       desc: "Built on the W3C Web Audio standard — no plugins, no installs, runs natively in every modern browser." },
  { icon: <IconLock />,  value: "100% Client-side",    desc: "Your audio never leaves your device. All DSP processing happens locally — complete privacy guaranteed." },
  { icon: <IconCheck />, value: "Industry Standards",  desc: "Spotify -14 LUFS · Apple Music -16 LUFS · -0.3 dBTP true-peak limit — streaming platforms ready." },
];

const pricing: { name: string; gbpPrice: number; periodKey: "oneTime" | "perMonth" | "perYear"; desc: string; features: string[]; featured: boolean; plan: WaitlistPlan }[] = [
  { name: "Single Session", gbpPrice: 79,  periodKey: "oneTime",  plan: "single", featured: false, desc: "One professional mastering session for a single track.", features: ["1 track mastered", "-14 LUFS / -0.3 dBTP", "WAV + MP3 download", "24h turnaround"] },
  { name: "Studio Pass",    gbpPrice: 49,  periodKey: "perMonth", plan: "studio", featured: false, desc: "For producers releasing regularly.",                     features: ["Unlimited masterings", "BPM + Key detector", "DJ Set Planner", "Priority processing", "Stem separation"] },
  { name: "Pro Pass",       gbpPrice: 199, periodKey: "perYear",  plan: "pro",    featured: true,  desc: "Everything in Studio Pass — billed annually.", features: ["All Studio Pass features", "SAVE_VS_MONTHLY", "Early access to new tools", "Label export formats", "Dedicated support", "Audio Converter — only from DJ Andy’K, free exclusively with Pro Pass"] },
];

const individualTools: { id: string; icon: React.ReactNode; name: string; gbpPrice: number; desc: string }[] = [
  { id: "tool_mastering",  icon: <IconEqualizer />, name: "Mastering Tool",    gbpPrice: 19, desc: "Normalize to -14 LUFS, apply EQ, stereo widening, and limit to -0.3 dBTP." },
  { id: "tool_bpm",        icon: <IconPulse />,     name: "BPM + Key Detector", gbpPrice: 9,  desc: "Instant BPM, musical key via Camelot wheel, tap BPM, and analysis history." },
  { id: "tool_planner",    icon: <IconVinyl />,     name: "DJ Set Planner",    gbpPrice: 12, desc: "Drag & drop tracks, auto-sort by Camelot key, visualise energy flow." },
  { id: "tool_comparator", icon: <IconScales />,    name: "Track Comparator",  gbpPrice: 9,  desc: "Compare waveforms, LUFS levels, and frequency content side-by-side." },
  { id: "tool_chord",      icon: <IconMusic />,     name: "Chord Generator",   gbpPrice: 9,  desc: "Generate chord progressions in any key and preview voicings." },
  { id: "tool_metronome",  icon: <IconMetronome />, name: "Metronome",         gbpPrice: 3,  desc: "Precision browser metronome with adjustable BPM and tap tempo." },
  { id: "tool_loudness",   icon: <IconVolume />,    name: "Loudness Meter",    gbpPrice: 9,  desc: "Real-time LUFS, RMS, and true-peak metering against streaming targets." },
  { id: "tool_stems",      icon: <IconLayers />,    name: "Stem Splitter",     gbpPrice: 12, desc: "Separate vocals, drums, bass, and stems — entirely in-browser." },
];

// ── Main component ────────────────────────────────────────────────────────────

type Spots = { spots_left: number; total: number; closed: boolean };

export default function HomeClient() {
  const router = useRouter();
  const { t } = useLanguage();
  const [waitlistPlan, setWaitlistPlan] = useState<WaitlistPlan>("studio");
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [spots, setSpots] = useState<Spots | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [discountInput, setDiscountInput] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountStatus, setDiscountStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [currency, setCurrency] = useState<Currency>("GBP");
  const [pricingTab, setPricingTab] = useState<"plans" | "tools">("plans");
  const [checkoutEmail, setCheckoutEmail] = useState("");
  const [checkoutEmailError, setCheckoutEmailError] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsError, setTermsError] = useState("");
  const [introMuted, setIntroMuted] = useState(true);
  const [introPlaying, setIntroPlaying] = useState(false);
  const [introProgress, setIntroProgress] = useState(0);
  const [introVisible, setIntroVisible] = useState(false);
  const [demoPlaying, setDemoPlaying] = useState<"before" | "after" | null>(null);
  const [demoProgress, setDemoProgress] = useState(0);
  const introRef = useRef<HTMLAudioElement | null>(null);
  const beforeAudioRef = useRef<HTMLAudioElement | null>(null);
  const afterAudioRef = useRef<HTMLAudioElement | null>(null);

  // Intro autoplay (muted) — skip if dismissed this session
  useEffect(() => {
    if (sessionStorage.getItem("intro_dismissed") === "1") return;
    setIntroVisible(true);
    const audio = new Audio("/audio/after.mp3");
    audio.loop = true;
    audio.muted = true;
    audio.addEventListener("timeupdate", () => {
      if (audio.duration > 0) setIntroProgress(audio.currentTime / audio.duration);
    });
    audio.play()
      .then(() => setIntroPlaying(true))
      .catch(() => setIntroPlaying(false));
    introRef.current = audio;
    return () => { audio.pause(); };
  }, []);

  // Demo audio setup
  useEffect(() => {
    const before = new Audio("/audio/before.mp3");
    const after  = new Audio("/audio/after.mp3");
    const onUpdate = (e: Event) => {
      const el = e.target as HTMLAudioElement;
      if (el.duration > 0) setDemoProgress(el.currentTime / el.duration);
    };
    const onEnd = () => { setDemoPlaying(null); setDemoProgress(0); };
    before.addEventListener("timeupdate", onUpdate);
    after.addEventListener("timeupdate", onUpdate);
    before.addEventListener("ended", onEnd);
    after.addEventListener("ended", onEnd);
    beforeAudioRef.current = before;
    afterAudioRef.current  = after;
    return () => { before.pause(); after.pause(); };
  }, []);

  const toggleIntroPlay = () => {
    if (!introRef.current) return;
    if (introRef.current.paused) {
      introRef.current.play().catch(() => {});
      setIntroPlaying(true);
    } else {
      introRef.current.pause();
      setIntroPlaying(false);
    }
  };

  const toggleIntroMute = () => {
    if (!introRef.current) return;
    introRef.current.muted = !introRef.current.muted;
    setIntroMuted(introRef.current.muted);
  };

  const dismissIntro = () => {
    introRef.current?.pause();
    setIntroVisible(false);
    sessionStorage.setItem("intro_dismissed", "1");
  };

  const playDemo = (track: "before" | "after") => {
    const ref = track === "before" ? beforeAudioRef : afterAudioRef;
    const other = track === "before" ? afterAudioRef : beforeAudioRef;
    other.current?.pause();
    if (demoPlaying === track) {
      ref.current?.pause();
      setDemoPlaying(null);
    } else {
      if (ref.current) { ref.current.currentTime = 0; ref.current.play().catch(() => {}); }
      setDemoProgress(0);
      setDemoPlaying(track);
    }
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem("andyk_currency") as Currency;
      if (saved && (CURRENCIES as readonly string[]).includes(saved)) setCurrency(saved);
    } catch { /* ignore */ }
  }, []);

  const handleCurrency = (c: Currency) => {
    setCurrency(c);
    try { localStorage.setItem("andyk_currency", c); } catch { /* ignore */ }
  };

  const fetchSpots = useCallback(async () => {
    try {
      const res = await fetch("/api/spots", { cache: "no-store" });
      if (res.ok) setSpots(await res.json());
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => { fetchSpots(); }, [fetchSpots]);

  const openWaitlist = (plan: WaitlistPlan = "studio") => {
    setWaitlistPlan(plan);
    setWaitlistOpen(true);
  };

  const applyDiscount = async () => {
    const code = discountInput.trim().toUpperCase();
    if (!code) return;
    setDiscountStatus("checking");
    try {
      const res = await fetch("/api/discount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (data.valid) {
        setDiscountCode(code);
        setDiscountPercent(data.discount_percent);
        setDiscountStatus("valid");
      } else {
        setDiscountStatus("invalid");
      }
    } catch {
      setDiscountStatus("invalid");
    }
  };

  const discountedGbp = (gbp: number) =>
    discountPercent > 0 ? Math.round(gbp * (1 - discountPercent / 100)) : gbp;

  const handleCheckout = async (plan: string) => {
    if (!termsAccepted) {
      setTermsError("Please accept the Pricing & Access Terms before continuing.");
      return;
    }
    setTermsError("");
    const emailTrimmed = checkoutEmail.trim().toLowerCase();
    if (!emailTrimmed || !emailTrimmed.includes("@")) {
      setCheckoutEmailError("Please enter your email address before continuing.");
      return;
    }
    setCheckoutEmailError("");
    setLoadingPlan(plan);
    try {
      const endpoint =
        plan === "single" ? "/api/revolut/order" : "/api/revolut/subscription";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          email: emailTrimmed,
          discount_code: discountCode || undefined,
          accepted_pricing_terms: true,
          accepted_pricing_terms_version: "v1.0",
        }),
      });
      const data = await res.json();
      if (data.checkout_url) {
        if (data.order_id) {
          // localStorage — must survive the redirect to Revolut's checkout and back,
          // including if that lands in a new tab/context (some mobile browsers do this).
          try { localStorage.setItem("andyk_order_id", data.order_id); } catch { /* ignore */ }
        }
        window.location.href = data.checkout_url;
      } else {
        throw new Error("No checkout URL");
      }
    } catch {
      setLoadingPlan(null);
      alert("Something went wrong. Please try again.");
    }
  };

  return (
    <div>
      {waitlistOpen && <WaitlistForm initialPlan={waitlistPlan} onClose={() => setWaitlistOpen(false)} onSuccess={fetchSpots} />}

      {/* ── HERO ── */}
      <section className="hero-section">
        <div className="hero-bg" />
        <div className="hero-grid-dots" />
        <HeroWaveform />

        <div className="hero-content">
          <ScrollReveal>
            <span className="hero-eyebrow">{t.hero.eyebrow}</span>
          </ScrollReveal>

          <ScrollReveal delay={1}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <Image
                src="/logo-transparent.png"
                alt="Andy'K Music Lab"
                width={180}
                height={180}
              />
            </div>
            <h1 className="hero-title">
              Andy&apos;K<br />
              <span className="serif-accent">Music</span> Lab
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={2}>
            <p className="hero-subtitle">
              {t.hero.subtitle}
            </p>
          </ScrollReveal>

          <ScrollReveal delay={3}>
            <div className="hero-ctas">
              <button onClick={() => openWaitlist("studio")} className="btn-primary">
                {t.hero.ctaPrimary}
                <IconArrow />
              </button>
              <a href="#pricing" className="btn-secondary">
                {t.hero.ctaSecondary}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 5v14M5 12l7 7 7-7"/>
                </svg>
              </a>
            </div>

            <div className="trust-badges">
              <span className="trust-badge"><span className="trust-check">✓</span>{t.hero.badge1}</span>
              <span className="trust-badge"><span className="trust-check">✓</span>{t.hero.badge2}</span>
              <span className="trust-badge"><span className="trust-check">✓</span>{t.hero.badge3}</span>
            </div>

            <div style={{ marginTop: 20, textAlign: "center" }}>
              <a
                href="https://www.instagram.com/andykmusiclab/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#737373", textDecoration: "none", letterSpacing: "0.04em" }}
              >
                Follow on Instagram: @andykmusiclab →
              </a>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <div className="divider-glow" />

      {/* ── THIS IS MY CHOICE — campaign card ── */}
      <section className="section-surface py-16 px-6">
        <div
          style={{
            maxWidth: 760,
            margin: "0 auto",
            textAlign: "center",
            padding: "48px 32px",
            background: "#ffffff",
            border: "1px solid rgba(0,0,0,0.1)",
            borderRadius: 16,
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#a3a3a3",
              margin: "0 0 16px",
            }}
          >
            Competition
          </p>
          <h2 style={{ fontFamily: "var(--font-sans, sans-serif)", fontSize: "clamp(1.5rem, 1.2rem + 1.2vw, 2.25rem)", fontWeight: 700, letterSpacing: "-0.02em", color: "#111111", margin: "0 0 8px" }}>
            This Is My Choice
          </h2>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "#737373", margin: "0 0 20px" }}>
            by DJ Andy&apos;K
          </p>
          <p style={{ fontFamily: "var(--font-sans, sans-serif)", fontSize: 15, color: "#525252", lineHeight: 1.6, margin: "0 auto 28px", maxWidth: 480 }}>
            Choose a DJ Andy&apos;K track and compete for Lifetime Unlimited Access to Andy&apos;K Music Lab.
          </p>
          <a
            href="https://www.djandykofficial.com/this-is-my-choice"
            style={{
              display: "inline-block",
              padding: "14px 28px",
              background: "#111111",
              color: "#ffffff",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              textDecoration: "none",
              border: "none",
            }}
          >
            View the Competition →
          </a>
          <div style={{ marginTop: 16 }}>
            <a
              href="https://www.djandykofficial.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#737373",
                textDecoration: "none",
              }}
            >
              More About DJ Andy&apos;K →
            </a>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="section-dark py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-16">
              <span className="section-label">How It Works</span>
              <h2 className="section-heading">
                <AltHead>Three steps to a professional master</AltHead>
              </h2>
              <p className="section-subtext mx-auto">
                Everything runs in your browser — private, fast, and powered by the Web Audio API.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid md:grid-cols-3 gap-6">
            {steps.map((s, i) => (
              <ScrollReveal key={s.num} delay={(i % 3) as 0 | 1 | 2 | 3}>
                <div className="step-card h-full">
                  <div className="step-number">Step {s.num}</div>
                  <div className="step-icon">{s.icon}</div>
                  <h3 className="step-title">{s.title}</h3>
                  <p className="step-desc">{s.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <div className="divider-glow" />

      {/* ── TOOLS ── */}
      <section id="tools" className="section-surface py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <div className="mb-16">
              <span className="section-label">{t.tools.label}</span>
              <h2 className="section-heading">
                <AltHead>{t.tools.heading}</AltHead>
              </h2>
              <p className="section-subtext">
                {t.tools.description}
              </p>
            </div>
          </ScrollReveal>

          <div className="grid md:grid-cols-3 gap-6">
            {tools.map((tool, i) => (
              <ScrollReveal key={tool.href} delay={(i % 3) as 0 | 1 | 2 | 3}>
                <div
                  className="premium-tool-card"
                  style={{ cursor: "pointer" }}
                  onClick={() => router.push(tool.href)}
                  role="link"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && router.push(tool.href)}
                >
                  <div className="premium-tool-icon">{tool.icon}</div>
                  <span className="premium-tool-badge">{t.tools.accountRequired}</span>
                  <h3 className="premium-tool-name">{tool.title}</h3>
                  <p className="premium-tool-desc">{tool.desc}</p>
                  <button
                    onClick={(e) => { e.stopPropagation(); openWaitlist(tool.plan); }}
                    className="try-free-btn"
                    style={{ cursor: "pointer", background: "none", border: "none", padding: 0, font: "inherit" }}
                  >
                    {t.tools.joinWaitlist} <IconArrow />
                  </button>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <div className="divider-glow" />

      {/* ── WHY THE LAB EXISTS ── */}
      <section className="section-surface py-28 px-6">
        <div className="max-w-3xl mx-auto">
          <ScrollReveal>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(0,0,0,0.38)" }}>
              {t.whyExists.label}
            </span>
            <h2 className="section-heading mt-3 mb-10">
              {t.whyExists.heading} <span className="serif-accent">{t.whyExists.headingItalic}</span>
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={1}>
            <div style={{ fontSize: 16, color: "#525252", lineHeight: 1.85, fontFamily: "var(--font-sans)" }}>
              <p style={{ marginBottom: 20 }}>{t.whyExists.body1}</p>
              <p style={{ marginBottom: 20 }}>{t.whyExists.body2}</p>
              <p>{t.whyExists.body3}</p>
            </div>
            <div style={{ borderLeft: "2px solid #111111", paddingLeft: 28, marginTop: 44 }}>
              <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: "clamp(1.1rem,2vw,1.35rem)", color: "#111111", lineHeight: 1.55, margin: 0 }}>
                &ldquo;{t.whyExists.quote}&rdquo;
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <div className="divider-glow" />

      {/* ── WHO IT IS FOR ── */}
      <section className="py-28 px-6" style={{ background: "#f5f5f5" }}>
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-16">
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(0,0,0,0.38)" }}>
                {t.whoFor.label}
              </span>
              <h2 className="section-heading mt-3">
                {t.whoFor.heading} <span className="serif-accent">{t.whoFor.headingItalic}</span>
              </h2>
            </div>
          </ScrollReveal>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { badge: t.whoFor.producers, title: t.whoFor.producers, body: t.whoFor.producersDesc },
              { badge: t.whoFor.djs,       title: t.whoFor.djs,       body: t.whoFor.djsDesc },
              { badge: t.whoFor.artists,   title: t.whoFor.artists,   body: t.whoFor.artistsDesc },
            ].map((card, i) => (
              <ScrollReveal key={i} delay={(i % 3) as 0 | 1 | 2}>
                <div className="premium-tool-card">
                  <span className="premium-tool-badge">{card.badge}</span>
                  <h3 className="premium-tool-name">{card.title}</h3>
                  <p className="premium-tool-desc">{card.body}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <div className="divider-glow" />

      {/* ── EDUCATION ACCESS ── */}
      <section className="section-surface py-28 px-6">
        <div className="max-w-3xl mx-auto">
          <ScrollReveal>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(0,0,0,0.38)" }}>
              Education Access
            </span>
            <h2 className="section-heading mt-3 mb-10">
              Limited Education <span className="serif-accent">Access</span>
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={1}>
            <div style={{ fontSize: 16, color: "#525252", lineHeight: 1.85, fontFamily: "var(--font-sans)" }}>
              <p style={{ marginBottom: 20 }}>
                Selected music schools, DJ courses and producer communities can request free or discounted access to Andy&apos;K Music Lab for students.
              </p>
              <p style={{ marginBottom: 20 }}>
                In exchange, we may ask for student feedback, community visibility, or a simple mention as an education partner.
              </p>
              <p>
                This is designed for learning environments where producers and DJs need practical browser-based tools for mastering, BPM + key detection, DJ set planning, loudness, stems and creative workflow.
              </p>
            </div>
            <div style={{ marginTop: 40 }}>
              <a
                href="/education-access"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "14px 28px",
                  background: "#111111",
                  color: "#ffffff",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  textDecoration: "none",
                  borderRadius: 0,
                  border: "none",
                }}
              >
                Request Education Access →
              </a>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <div className="divider-glow" />

      {/* ── FOUNDER ── */}
      <section className="section-surface py-28 px-6">
        <div className="max-w-3xl mx-auto">
          <ScrollReveal>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(0,0,0,0.38)" }}>
              {t.founder.label}
            </span>
            <h2 className="section-heading mt-3 mb-10">
              {t.founder.heading} <span className="serif-accent">{t.founder.headingItalic}</span>
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={1}>
            <p style={{ fontSize: 16, color: "#525252", lineHeight: 1.85, fontFamily: "var(--font-sans)", marginBottom: 36 }}>
              {t.founder.body}
            </p>
            <a
              href="https://djandykofficial.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex", alignItems: "center",
                fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700,
                letterSpacing: "0.12em", textTransform: "uppercase",
                color: "#111111", textDecoration: "none",
                borderBottom: "1.5px solid #111111", paddingBottom: 3,
              }}
            >
              {t.founder.cta}
            </a>
          </ScrollReveal>
        </div>
      </section>

      <div className="divider-glow" />

      {/* ── STATS ── */}
      <section className="stats-strip">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="grid md:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x divide-white/5">
            {stats.map((s, i) => (
              <ScrollReveal key={i} delay={(i % 3) as 0 | 1 | 2 | 3} className="px-8 py-6 md:py-0">
                <div className="stat-item">
                  <div className="stat-item-icon">{s.icon}</div>
                  <div className="stat-item-value">{s.value}</div>
                  <p className="stat-item-desc">{s.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <div className="divider-glow" />

      {/* ── MASTERING DEMO ── */}
      <section className="section-surface py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <ScrollReveal>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(0,0,0,0.38)" }}>
              {t.mastering.label}
            </span>
            <h2 className="section-heading mt-3 mb-10">
              {t.mastering.heading} <span className="serif-accent">{t.mastering.headingItalic}</span>
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={1}>
            <style>{`
              @keyframes demoBar {
                0%   { transform: scaleY(0.2); }
                100% { transform: scaleY(1); }
              }
            `}</style>
            <div style={{ display: "flex", gap: 24, justifyContent: "center", marginBottom: 20, flexWrap: "wrap" }}>
              {(["before", "after"] as const).map(track => {
                const active = demoPlaying === track;
                const BAR_SCALES = [0.55, 0.9, 0.65, 1, 0.45, 0.8, 0.6, 0.95, 0.7, 0.5, 0.85, 0.75];
                return (
                  <div key={track} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                    <button
                      onClick={() => playDemo(track)}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "14px 32px", borderRadius: 0,
                        fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700,
                        letterSpacing: "0.12em", textTransform: "uppercase",
                        background: active ? "#111111" : "transparent",
                        color: active ? "#ffffff" : "#111111",
                        border: "1.5px solid #111111",
                        cursor: "pointer", transition: "background 0.15s ease, color 0.15s ease",
                        minWidth: 140,
                      }}
                    >
                      <span style={{ fontSize: 13 }}>{active ? "■" : "▶"}</span>
                      {track === "before" ? "Before" : "After"}
                    </button>
                    {/* Waveform bars */}
                    <div style={{ display: "flex", gap: 3, alignItems: "center", height: 28 }}>
                      {BAR_SCALES.map((s, i) => (
                        <div
                          key={i}
                          style={{
                            width: 3,
                            height: 28,
                            background: "#111111",
                            borderRadius: 1,
                            transform: `scaleY(${active ? s : 0.25})`,
                            animation: active
                              ? `demoBar ${0.45 + (i % 4) * 0.12}s ease-in-out ${(i * 0.06).toFixed(2)}s infinite alternate`
                              : "none",
                            transition: active ? "none" : "transform 0.4s ease",
                          }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ height: 1, background: "rgba(0,0,0,0.1)", maxWidth: 380, margin: "0 auto 10px", overflow: "hidden" }}>
              <div style={{ height: "100%", background: "#111111", width: `${demoProgress * 100}%`, transition: "width 0.15s linear" }} />
            </div>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(0,0,0,0.3)", margin: 0, minHeight: 16 }}>
              {demoPlaying === "before" ? "Playing: Unmastered" : demoPlaying === "after" ? "Playing: Mastered — −14 LUFS" : ""}
            </p>
          </ScrollReveal>
        </div>
      </section>

      <div className="divider-glow" />

      {/* ── PRICING ── */}
      <section id="pricing" className="section-dark py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-16">
              <span className="section-label">{t.pricing.label}</span>
              <h2 className="section-heading">
                <AltHead>{t.pricing.heading}</AltHead>
              </h2>
              <p className="section-subtext mx-auto">
                {t.pricing.subtitle}
              </p>
            </div>
          </ScrollReveal>

          {/* Pricing tab switcher */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
            <div style={{ display: "inline-flex", gap: 0 }}>
              {(["plans", "tools"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setPricingTab(tab)}
                  style={{
                    padding: "6px 20px",
                    borderRadius: 0,
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    border: "1px solid rgba(255,255,255,0.4)",
                    borderRight: tab === "plans" ? "none" : "1px solid rgba(255,255,255,0.4)",
                    background: pricingTab === tab ? "#ffffff" : "transparent",
                    color: pricingTab === tab ? "#111111" : "rgba(255,255,255,0.65)",
                    cursor: "pointer",
                    transition: "background 0.15s ease, color 0.15s ease",
                  }}
                >
                  {tab === "plans" ? "Plans" : "Individual Tools"}
                </button>
              ))}
            </div>
          </div>

          {/* VAT note */}
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#a3a3a3", textAlign: "center", marginBottom: 20 }}>
            VAT/tax may apply depending on your location and payment provider.
          </p>

          {/* Currency selector */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
            <div style={{
              display: "inline-flex", gap: 0,
              background: "#ffffff",
              border: "1px solid #111111",
              overflow: "hidden",
            }}>
              {CURRENCIES.map(c => (
                <button
                  key={c}
                  onClick={() => handleCurrency(c)}
                  style={{
                    padding: "5px 14px",
                    borderRadius: 0,
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    border: "none",
                    borderRight: c !== "PYG" ? "1px solid #111111" : "none",
                    background: currency === c ? "#111111" : "transparent",
                    color: currency === c ? "#ffffff" : "#111111",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Currency disclaimer */}
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#a3a3a3", textAlign: "right", marginTop: 8, marginBottom: 0 }}>
            Prices shown in GBP. Other currencies are approximate. Final amount charged in GBP by{" "}
            <a href="https://www.revolut.com/business/" target="_blank" rel="noopener noreferrer" style={{ color: "#a3a3a3", textDecoration: "underline" }}>Revolut Business</a>.
          </p>

          {/* Discount code input */}
          <div style={{ marginBottom: 24, display: "flex", gap: 0, flexWrap: "wrap" }}>
            <input
              type="text"
              value={discountInput}
              onChange={e => { setDiscountInput(e.target.value.toUpperCase()); if (discountStatus !== "idle") setDiscountStatus("idle"); }}
              onKeyDown={e => e.key === "Enter" && applyDiscount()}
              placeholder="Have a discount code?"
              style={{
                flex: 1,
                minWidth: 180,
                padding: "10px 14px",
                background: "#ffffff",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRight: "none",
                borderRadius: 0,
                color: "#111111",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                letterSpacing: "0.06em",
                outline: "none",
              }}
            />
            <button
              onClick={applyDiscount}
              disabled={discountStatus === "checking" || discountStatus === "valid"}
              style={{
                padding: "10px 20px",
                background: discountStatus === "valid" ? "#16a34a" : "#ffffff",
                color: discountStatus === "valid" ? "#ffffff" : "#111111",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 0,
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
              }}
            >
              {discountStatus === "checking" ? "…" : discountStatus === "valid" ? "✓ Applied" : "Apply"}
            </button>
            {discountStatus === "invalid" && (
              <span style={{ width: "100%", fontFamily: "var(--font-mono)", fontSize: 10, color: "#f87171", letterSpacing: "0.1em", paddingTop: 6 }}>
                Invalid or already used code.
              </span>
            )}
            {discountStatus === "valid" && (
              <span style={{ width: "100%", fontFamily: "var(--font-mono)", fontSize: 10, color: "#4ade80", letterSpacing: "0.1em", paddingTop: 6 }}>
                {discountPercent}% discount applied to all plans.
              </span>
            )}
          </div>

          {/* Early access banner */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ background: "#111111", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "6px 16px" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#ffffff" }}>
                Early Access — First 40 Members Get 40% Off
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: spots?.closed ? "rgba(255,255,255,0.35)" : spots?.spots_left !== undefined && spots.spots_left <= 5 ? "#f87171" : "rgba(255,255,255,0.75)", whiteSpace: "nowrap" }}>
                {spots ? (spots.closed ? "Early Access Closed" : `${spots.spots_left} Spots Remaining`) : "— Spots Remaining"}
              </span>
            </div>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#a3a3a3", margin: "8px 0 0" }}>
              <button
                onClick={() => openWaitlist("studio")}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: "inherit", color: "#a3a3a3", textDecoration: "underline" }}
              >
                Join the waitlist to lock in your discount →
              </button>
            </p>
          </div>

          {/* Email for access */}
          <div style={{ marginBottom: 16 }}>
            <input
              type="email"
              value={checkoutEmail}
              onChange={e => { setCheckoutEmail(e.target.value); if (checkoutEmailError) setCheckoutEmailError(""); }}
              placeholder="Your email address for access"
              style={{
                width: "100%",
                padding: "10px 14px",
                background: "#ffffff",
                border: `1px solid ${checkoutEmailError ? "#f87171" : "rgba(255,255,255,0.2)"}`,
                borderRadius: 0,
                color: "#111111",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                letterSpacing: "0.06em",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            {checkoutEmailError && (
              <span style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 10, color: "#f87171", letterSpacing: "0.1em", paddingTop: 6 }}>
                {checkoutEmailError}
              </span>
            )}
          </div>

          {/* Terms acceptance */}
          <div style={{ marginBottom: 20, padding: "14px 18px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)" }}>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={e => { setTermsAccepted(e.target.checked); if (termsError) setTermsError(""); }}
                style={{ marginTop: 2, width: 14, height: 14, flexShrink: 0, accentColor: "#ffffff", cursor: "pointer" }}
              />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>
                I have read and agree to the{" "}
                <a href="/pricing-terms" target="_blank" rel="noopener noreferrer" style={{ color: "#ffffff", textDecoration: "underline" }}>
                  Pricing &amp; Access Terms
                </a>
                , including the discount, refund and education access rules.
              </span>
            </label>
            {termsError && (
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#f87171", margin: "8px 0 0", letterSpacing: "0.05em" }}>
                {termsError}
              </p>
            )}
          </div>

          {/* Plans tab */}
          {pricingTab === "plans" && (
            <div className="grid md:grid-cols-3 gap-6 items-stretch">
              {pricing.map((plan, i) => (
                <ScrollReveal key={plan.name} delay={(i % 3) as 0 | 1 | 2 | 3}>
                  <div className={`pricing-card h-full ${plan.featured ? "featured" : ""}`}>
                    {plan.featured && <span className="pricing-badge">{t.pricing.mostPopular}</span>}
                    <div className="mb-2">
                      <span
                        className="pricing-price"
                        style={discountPercent > 0 ? { textDecoration: "line-through", opacity: 0.4, fontSize: "1.1rem" } : undefined}
                      >
                        {convert(plan.gbpPrice, currency)}
                      </span>
                      {discountPercent > 0 && (
                        <span className="pricing-price" style={{ marginLeft: 8 }}>
                          {convert(discountedGbp(plan.gbpPrice), currency)}
                        </span>
                      )}
                      <span className="pricing-period">{t.pricing[plan.periodKey]}</span>
                      {discountPercent > 0 && (
                        <span style={{ marginLeft: 10, padding: "2px 8px", background: "#16a34a", color: "#fff", fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700, letterSpacing: "0.08em", verticalAlign: "middle" }}>
                          {discountPercent}% OFF
                        </span>
                      )}
                    </div>
                    <div className="pricing-name">{plan.name}</div>
                    <p className="pricing-desc">{plan.desc}</p>
                    <div className="pricing-features">
                      {plan.features.map((f) => (
                        <div key={f} className={`pricing-feature${f.startsWith("Audio Converter") ? " feature-new-pulse" : ""}`}>
                          <span className="pricing-check">✓</span>
                          <span>{f === "SAVE_VS_MONTHLY" ? `Save ${convert(149, currency)} vs monthly` : f}</span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => handleCheckout(plan.plan)}
                      className={`pricing-cta ${plan.featured ? "pricing-cta-featured" : "pricing-cta-default"}`}
                      style={{ cursor: loadingPlan ? "wait" : "pointer", opacity: loadingPlan === plan.plan ? 0.6 : 1 }}
                      disabled={loadingPlan !== null}
                    >
                      {loadingPlan === plan.plan ? "Processing…" : "Get Access →"}
                    </button>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          )}

          {/* Individual tools tab */}
          {pricingTab === "tools" && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {individualTools.map((tool, i) => (
                  <ScrollReveal key={tool.id} delay={(i % 4) as 0 | 1 | 2 | 3}>
                    <div className="pricing-card h-full" style={{ display: "flex", flexDirection: "column" }}>
                      <div style={{ marginBottom: 6 }}>
                        <span
                          className="pricing-price"
                          style={discountPercent > 0 ? { textDecoration: "line-through", opacity: 0.4, fontSize: "1.1rem" } : undefined}
                        >
                          {convert(tool.gbpPrice, currency)}
                        </span>
                        {discountPercent > 0 && (
                          <span className="pricing-price" style={{ marginLeft: 8 }}>
                            {convert(discountedGbp(tool.gbpPrice), currency)}
                          </span>
                        )}
                        <span className="pricing-period">/mo</span>
                        {discountPercent > 0 && (
                          <span style={{ marginLeft: 8, padding: "2px 8px", background: "#16a34a", color: "#fff", fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700, letterSpacing: "0.08em", verticalAlign: "middle" }}>
                            {discountPercent}% OFF
                          </span>
                        )}
                      </div>
                      <div className="pricing-name" style={{ fontFamily: "var(--font-sans)", fontWeight: 700 }}>{tool.name}</div>
                      <p className="pricing-desc" style={{ flex: 1 }}>{tool.desc}</p>
                      <button
                        onClick={() => handleCheckout(tool.id)}
                        className="pricing-cta pricing-cta-default"
                        style={{ cursor: loadingPlan ? "wait" : "pointer", opacity: loadingPlan === tool.id ? 0.6 : 1, marginTop: "auto" }}
                        disabled={loadingPlan !== null}
                      >
                        {loadingPlan === tool.id ? "Processing…" : "Get Access →"}
                      </button>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#737373", textAlign: "center", marginTop: 24 }}>
                Buying all tools individually would cost {convert(82, currency)}/month. Full Lab access gives you all 8 tools for less than buying them separately.
              </p>
            </>
          )}

          <ScrollReveal>
            <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 10, alignItems: "center", textAlign: "center" }}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(255,255,255,0.45)", margin: 0 }}>
                Early access is open. Payments are securely processed by Revolut Business.
              </p>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(255,255,255,0.35)", margin: 0 }}>
                Have an early access code? Use it at checkout for 40% off.
              </p>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(255,255,255,0.25)", margin: 0 }}>
                By purchasing access, you agree to the{" "}
                <a href="/pricing-terms" style={{ color: "rgba(255,255,255,0.4)", textDecoration: "underline" }}>Pricing &amp; Access Terms</a>.
              </p>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,0.2)", margin: 0, maxWidth: 600, lineHeight: 1.65 }}>
                Discounted, coupon-based and education access purchases are generally non-refundable once access has been activated, except where required by law or where a verified technical issue prevents access for more than 40% of the active access period.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── INTRO PLAYER — floating card ── */}
      {introVisible && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9000,
          width: 320,
          background: "#ffffff",
          border: "1px solid #e5e5e5",
          borderRadius: 16,
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
          padding: "12px 14px",
          display: "flex", flexDirection: "column", gap: 10,
        }}>
          {/* Track row */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Album art */}
            <div style={{ flexShrink: 0, width: 64, height: 64, borderRadius: 10, background: "#111111", overflow: "hidden" }}>
              <Image src="/logo-transparent.png" alt="Andy'K Music Lab" width={64} height={64} style={{ objectFit: "cover" }} />
            </div>

            {/* Track info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700, color: "#111111", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                Andy&apos;K Music Lab
              </div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "#8a8a8a", marginTop: 1 }}>
                DJ Andy&apos;K
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#b0b0b0", marginTop: 3, letterSpacing: "0.08em" }}>
                · INTRO · 2026
              </div>
            </div>

            {/* Controls */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              {/* Mute/unmute — speaker icon */}
              <button
                onClick={toggleIntroMute}
                title={introMuted ? "Unmute" : "Mute"}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: introMuted ? "#c0c0c0" : "#111111", lineHeight: 1 }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  {introMuted ? (
                    <>
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <line x1="23" y1="9" x2="17" y2="15" />
                      <line x1="17" y1="9" x2="23" y2="15" />
                    </>
                  ) : (
                    <>
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    </>
                  )}
                </svg>
              </button>

              {/* Play/pause — black rounded square */}
              <button
                onClick={toggleIntroPlay}
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: "#111111", border: "none",
                  color: "#ffffff", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, flexShrink: 0,
                }}
              >
                {introPlaying ? "■" : "▶"}
              </button>

              {/* Close */}
              <button
                onClick={dismissIntro}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#c0c0c0", fontSize: 16, lineHeight: 1 }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ height: 2, background: "#f0f0f0", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", background: "#111111", width: `${introProgress * 100}%`, borderRadius: 2, transition: "width 0.2s linear" }} />
          </div>
        </div>
      )}
    </div>
  );
}
