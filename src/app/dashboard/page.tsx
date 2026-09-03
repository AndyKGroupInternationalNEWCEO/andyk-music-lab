"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const ADMIN_KEY = "andyk_lab_admin";

const TOOLS = [
  { name: "BPM + Key Detector",  desc: "Instant BPM via autocorrelation, musical key, Camelot wheel code, and danceability score.", href: "/bpm" },
  { name: "Mastering Tool",      desc: "Normalize to −14 LUFS, precision EQ, stereo widening, and true-peak limiting.",            href: "/mastering" },
  { name: "DJ Set Planner",      desc: "Build harmonically perfect sets using the Camelot Wheel with transition analysis.",         href: "/planner" },
  { name: "Track Comparator",    desc: "Compare two tracks side-by-side: LUFS, peak, DR, BPM, key, and Camelot.",                  href: "/track-comparator" },
  { name: "Chord Generator",     desc: "Generate chord progressions for Trance, House, Pop, and Cinematic with piano voicings.",   href: "/chord-generator" },
  { name: "Metronome",           desc: "Web Audio API metronome with tap tempo, time signatures, and subdivisions.",               href: "/metronome" },
  { name: "Loudness Meter",      desc: "Real-time LUFS from microphone or file. Momentary, short-term, and integrated readings.",  href: "/loudness-meter" },
  { name: "Stem Splitter",       desc: "Frequency-band stem splitting — Bass, Mids, Highs — each downloadable as WAV.",            href: "/stem-splitter" },
];

const PLAN_LABEL: Record<string, string> = {
  single: "One-time",
  studio: "Monthly",
  pro:    "Yearly",
};

type Entry = {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  created_at: string;
  notified: boolean;
};

type Filter = "all" | "single" | "studio" | "pro";

type EdRequest = {
  id: string;
  name: string;
  email: string;
  website: string | null;
  students_count: number | null;
  type: string | null;
  message: string | null;
  status: string;
  created_at: string;
};

const ED_STATUS_COLOR: Record<string, string> = {
  new:      "#111111",
  reviewed: "#737373",
  accepted: "#16a34a",
  rejected: "#ef4444",
};

type DiscountCode = {
  id: string;
  code: string;
  discount_percent: number;
  used: boolean;
  used_by_email: string | null;
  expires_at: string | null;
  plan_restriction: string | null;
  created_for_email: string | null;
  created_at: string;
};

const PLAN_OPTIONS = [
  { value: "all",       label: "All Plans" },
  { value: "studio",    label: "Studio Pass" },
  { value: "pro",       label: "Pro Pass" },
  { value: "single",    label: "Single Session" },
  { value: "mastering", label: "Mastering Tool" },
  { value: "bpm",       label: "BPM + Key" },
  { value: "planner",   label: "DJ Set Planner" },
];

function codeStatus(c: DiscountCode): { label: string; color: string } {
  if (c.used) return { label: "USED", color: "#8a8a8a" };
  if (c.expires_at && new Date(c.expires_at) < new Date()) return { label: "EXPIRED", color: "#ef4444" };
  return { label: "ACTIVE", color: "#16a34a" };
}

type Customer = {
  id: string;
  email: string;
  full_name: string | null;
  plan: string;
  subscription_status: string | null;
  plan_status: string;
  plan_started_at: string | null;
  plan_expires_at: string | null;
};

const CUST_PLAN_LABEL: Record<string, string> = {
  single: "Single Session", studio: "Studio Pass", pro: "Pro Pass",
  tool_mastering: "Mastering", tool_bpm: "BPM + Key", tool_planner: "DJ Planner",
  tool_comparator: "Comparator", tool_chord: "Chord Gen", tool_metronome: "Metronome",
  tool_loudness: "Loudness", tool_stems: "Stem Splitter",
};
const CUST_PLAN_PRICE: Record<string, number> = {
  studio: 49, pro: 17, single: 79,
  tool_mastering: 19, tool_bpm: 9, tool_planner: 12,
  tool_comparator: 9, tool_chord: 9, tool_metronome: 3, tool_loudness: 9, tool_stems: 12,
};
const CUST_STATUS_COLOR: Record<string, string> = {
  active: "#16a34a", expired: "#ef4444", cancelled: "#8a8a8a",
};

type CustFilter = "all" | "active" | "expired" | "cancelled";

// ── Shared style helpers ──────────────────────────────────────────────────────

const mono = "var(--font-mono, monospace)";
const sans = "var(--font-sans, sans-serif)";

const sectionLabel: React.CSSProperties = {
  fontFamily: mono, fontSize: 11, fontWeight: 700, letterSpacing: "0.15em",
  textTransform: "uppercase", color: "#8a8a8a", margin: "0 0 16px",
};

const tableHeader: React.CSSProperties = {
  fontFamily: mono, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
  textTransform: "uppercase", color: "#8a8a8a",
};

function btn(variant: "primary" | "ghost" | "outline"): React.CSSProperties {
  if (variant === "primary") return {
    padding: "8px 16px", fontSize: 11, fontWeight: 700, cursor: "pointer",
    border: "none", background: "#111111", color: "#ffffff",
    fontFamily: mono, letterSpacing: "0.1em", textTransform: "uppercase",
  };
  if (variant === "outline") return {
    padding: "8px 16px", fontSize: 11, fontWeight: 700, cursor: "pointer",
    border: "1px solid #e5e5e5", background: "transparent", color: "#525252",
    fontFamily: mono, letterSpacing: "0.1em", textTransform: "uppercase",
  };
  return {
    padding: "7px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer",
    border: "1px solid #e5e5e5", background: "transparent", color: "#525252",
    fontFamily: mono, letterSpacing: "0.08em",
  };
}

function filterBtn(active: boolean): React.CSSProperties {
  return {
    padding: "5px 12px", fontSize: 11, fontWeight: 700,
    border: "1px solid " + (active ? "#111111" : "#e5e5e5"),
    background: active ? "#111111" : "transparent",
    color: active ? "#ffffff" : "#525252",
    cursor: "pointer", fontFamily: mono, letterSpacing: "0.08em",
    textTransform: "uppercase",
  };
}

function statusTag(notified: boolean): React.CSSProperties {
  return {
    display: "inline-block", padding: "2px 7px", fontSize: 10, fontWeight: 700,
    fontFamily: mono, letterSpacing: "0.08em", textTransform: "uppercase",
    background: notified ? "#f5f5f5" : "#111111",
    color: notified ? "#8a8a8a" : "#ffffff",
  };
}

function inputStyle(): React.CSSProperties {
  return {
    width: "100%", padding: "9px 12px", border: "1px solid #e5e5e5",
    borderRadius: 0, fontSize: 13, fontFamily: mono, outline: "none",
    boxSizing: "border-box", color: "#111111", background: "#ffffff",
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [notifyingId, setNotifyingId] = useState<string | null>(null);
  const [notifyingAll, setNotifyingAll] = useState(false);
  const [notifyAllResult, setNotifyAllResult] = useState<string | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [custLoading, setCustLoading] = useState(false);
  const [custFilter, setCustFilter] = useState<CustFilter>("all");

  const [edRequests, setEdRequests] = useState<EdRequest[]>([]);
  const [edLoading, setEdLoading] = useState(false);
  const [edActingId, setEdActingId] = useState<string | null>(null);
  const [edPlanChoice, setEdPlanChoice] = useState<Record<string, string>>({});

  const [genEmail, setGenEmail] = useState("");
  const [genPercent, setGenPercent] = useState(40);
  const [genPlan, setGenPlan] = useState("all");
  const [genExpiry, setGenExpiry] = useState(72);
  const [genLoading, setGenLoading] = useState(false);
  const [genResult, setGenResult] = useState<{ code: string; email: string } | { error: string } | null>(null);
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [codesLoading, setCodesLoading] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(ADMIN_KEY) !== "true") { router.replace("/admin"); return; }
    } catch {}
    setReady(true);
  }, [router]);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/waitlist");
      if (res.ok) { const { entries: e } = await res.json(); setEntries(e ?? []); }
    } finally { setLoading(false); }
  }, []);

  const fetchCustomers = useCallback(async () => {
    setCustLoading(true);
    try {
      const res = await fetch("/api/admin/customers");
      if (res.ok) { const { customers: c } = await res.json(); setCustomers(c ?? []); }
    } finally { setCustLoading(false); }
  }, []);

  const fetchEdRequests = useCallback(async () => {
    setEdLoading(true);
    try {
      const res = await fetch("/api/admin/education");
      if (res.ok) { const { requests } = await res.json(); setEdRequests(requests ?? []); }
    } finally { setEdLoading(false); }
  }, []);

  const fetchCodes = useCallback(async () => {
    setCodesLoading(true);
    try {
      const res = await fetch("/api/admin/discount/generate");
      if (res.ok) { const { codes: c } = await res.json(); setCodes(c ?? []); }
    } finally { setCodesLoading(false); }
  }, []);

  useEffect(() => {
    if (ready) { fetchEntries(); fetchCodes(); fetchCustomers(); fetchEdRequests(); }
  }, [ready, fetchEntries, fetchCodes, fetchCustomers, fetchEdRequests]);

  async function logout() {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch { /* ignore */ }
    try { localStorage.removeItem(ADMIN_KEY); } catch {}
    router.replace("/admin");
  }

  async function generateDiscount(e: React.FormEvent) {
    e.preventDefault();
    setGenLoading(true);
    setGenResult(null);
    try {
      const res = await fetch("/api/admin/discount/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: genEmail.trim().toLowerCase(),
          discount_percent: genPercent,
          plan_restriction: genPlan,
          expiry_hours: genExpiry,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setGenResult({ code: data.code, email: genEmail.trim().toLowerCase() });
        setGenEmail("");
        fetchCodes();
      } else {
        setGenResult({ error: data.error ?? "Something went wrong" });
      }
    } catch {
      setGenResult({ error: "Network error" });
    } finally {
      setGenLoading(false);
    }
  }

  async function actOnEdRequest(id: string, action: "approve" | "reject") {
    setEdActingId(id);
    try {
      const res = await fetch(`/api/admin/education/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, plan: edPlanChoice[id] ?? "studio" }),
      });
      const data = await res.json();
      if (res.ok) {
        setEdRequests(prev => prev.map(r => r.id === id ? { ...r, status: data.status } : r));
      } else {
        alert(data.error ?? "Something went wrong");
      }
    } catch {
      alert("Network error");
    } finally {
      setEdActingId(null);
    }
  }

  async function notifyOne(id: string) {
    setNotifyingId(id);
    try {
      const res = await fetch(`/api/admin/waitlist/${id}`, { method: "POST" });
      if (res.ok) setEntries(prev => prev.map(e => e.id === id ? { ...e, notified: true } : e));
    } finally { setNotifyingId(null); }
  }

  async function notifyAll() {
    setNotifyingAll(true);
    setNotifyAllResult(null);
    try {
      const res = await fetch("/api/admin/waitlist/notify-all", { method: "POST" });
      if (res.ok) {
        const { count } = await res.json();
        setNotifyAllResult(`Sent to ${count} people`);
        await fetchEntries();
      }
    } finally { setNotifyingAll(false); }
  }

  const filtered = filter === "all" ? entries : entries.filter(e => e.plan === filter);
  const unnotifiedCount = entries.filter(e => !e.notified).length;

  // Stats derived from state
  const activeCustomers    = customers.filter(c => (c.plan_status || c.subscription_status) === "active");
  const expiredCustomers   = customers.filter(c => (c.plan_status || c.subscription_status) === "expired");
  const mrr                = activeCustomers.reduce((sum, c) => sum + (CUST_PLAN_PRICE[c.plan] ?? 0), 0);
  const usedCodes          = codes.filter(c => c.used).length;
  const activeCodes        = codes.filter(c => !c.used && (!c.expires_at || new Date(c.expires_at) > new Date())).length;
  const newEdRequests      = edRequests.filter(r => r.status === "new").length;

  if (!ready) return null;

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff", fontFamily: sans }}>

      {/* ── Top bar ── */}
      <div style={{ background: "#111111", padding: "0 32px", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#ffffff" }}>
          Andy&apos;K Music Lab Control Panel
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 7, height: 7, background: "#22c55e", borderRadius: "50%" }} />
            <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)" }}>
              LAB STATUS: ONLINE
            </span>
          </div>
          <button onClick={logout} style={{ ...btn("outline"), borderColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.55)" }}>
            LOG OUT
          </button>
        </div>
      </div>

      {/* ── Stats control panel ── */}
      <div style={{ borderBottom: "1px solid #e5e5e5", display: "flex" }}>
        {[
          {
            big: loading ? "—" : entries.length,
            label: "WAITLIST",
            small: loading ? "" : `${unnotifiedCount} unnotified`,
          },
          {
            big: custLoading ? "—" : activeCustomers.length,
            label: "ACTIVE USERS",
            small: custLoading ? "" : `${expiredCustomers.length} expired`,
          },
          {
            big: custLoading ? "—" : `£${mrr}`,
            label: "EST. MRR",
            small: "per month",
          },
          {
            big: codesLoading ? "—" : codes.length,
            label: "CODES SENT",
            small: codesLoading ? "" : `${usedCodes} used · ${activeCodes} active`,
          },
          {
            big: edLoading ? "—" : edRequests.length,
            label: "EDU REQUESTS",
            small: edLoading ? "" : `${newEdRequests} new`,
          },
        ].map((panel, i, arr) => (
          <div
            key={panel.label}
            style={{
              flex: 1,
              padding: "24px 28px",
              borderRight: i < arr.length - 1 ? "1px solid #e5e5e5" : "none",
              minWidth: 0,
            }}
          >
            <div style={{ fontFamily: mono, fontSize: 36, fontWeight: 700, color: "#111111", lineHeight: 1, marginBottom: 6 }}>
              {panel.big}
            </div>
            <div style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#8a8a8a", marginBottom: 4 }}>
              {panel.label}
            </div>
            <div style={{ fontFamily: mono, fontSize: 10, color: "#a3a3a3" }}>
              {panel.small}
            </div>
          </div>
        ))}
      </div>

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "40px 32px" }}>

        {/* ── Internal Tools ── */}
        <p style={{ ...sectionLabel }}>Internal Tools</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 0, background: "#e5e5e5", border: "1px solid #e5e5e5", marginBottom: 56 }}>
          {TOOLS.map(tool => (
            <a
              key={tool.href}
              href={tool.href}
              style={{ display: "block", padding: "16px 18px", border: "1px solid #e5e5e5", textDecoration: "none", background: "#ffffff" }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "#f5f5f5"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "#ffffff"; }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: "#111111" }}>{tool.name}</span>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#a3a3a3" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </div>
              <p style={{ fontFamily: sans, fontSize: 11, color: "#8a8a8a", lineHeight: 1.5, margin: 0 }}>{tool.desc}</p>
            </a>
          ))}
        </div>

        {/* ── Waitlist ── */}
        <div style={{ borderTop: "2px solid #111111", paddingTop: 36, marginBottom: 56 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
            <div>
              <p style={{ ...sectionLabel }}>Waitlist</p>
              <p style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color: "#111111", margin: 0 }}>
                {loading ? "—" : entries.length}
                {!loading && unnotifiedCount > 0 && (
                  <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 400, color: "#a3a3a3", marginLeft: 12 }}>
                    {unnotifiedCount} unnotified
                  </span>
                )}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {notifyAllResult && (
                <span style={{ fontFamily: mono, fontSize: 11, color: "#525252" }}>{notifyAllResult}</span>
              )}
              <button
                onClick={notifyAll}
                disabled={notifyingAll || unnotifiedCount === 0}
                style={{ ...btn("primary"), opacity: (notifyingAll || unnotifiedCount === 0) ? 0.4 : 1 }}
              >
                {notifyingAll ? "SENDING…" : `NOTIFY ALL (${unnotifiedCount})`}
              </button>
              <button onClick={fetchEntries} style={btn("ghost")}>↻</button>
            </div>
          </div>

          {/* Filter tabs */}
          <div style={{ display: "flex", gap: 0, marginBottom: 16, border: "1px solid #e5e5e5" }}>
            {(["all", "single", "studio", "pro"] as Filter[]).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{ ...filterBtn(filter === f), borderWidth: 0, borderRight: "1px solid #e5e5e5" }}>
                {f === "all" ? "ALL" : PLAN_LABEL[f].toUpperCase()}
                {f !== "all" && (
                  <span style={{ marginLeft: 6, opacity: 0.5, fontWeight: 400 }}>
                    {entries.filter(e => e.plan === f).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {loading ? (
            <p style={{ fontFamily: mono, fontSize: 12, color: "#a3a3a3", padding: "24px 0" }}>Loading waitlist…</p>
          ) : filtered.length === 0 ? (
            <p style={{ fontFamily: mono, fontSize: 12, color: "#a3a3a3", padding: "24px 0" }}>No entries.</p>
          ) : (
            <div style={{ border: "1px solid #e5e5e5", overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr 100px 120px 80px 90px", gap: 0, background: "#f5f5f5", borderBottom: "1px solid #e5e5e5", padding: "8px 16px" }}>
                {["Name", "Email", "Plan", "Date", "Status", ""].map(h => (
                  <span key={h} style={tableHeader}>{h}</span>
                ))}
              </div>
              {filtered.map((entry, i) => (
                <div
                  key={entry.id}
                  style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr 100px 120px 80px 90px", gap: 0, padding: "10px 16px", borderBottom: i < filtered.length - 1 ? "1px solid #f0f0f0" : "none", alignItems: "center", background: entry.notified ? "#fafafa" : "#ffffff" }}
                >
                  <span style={{ fontFamily: sans, fontSize: 13, color: "#111111", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {entry.name || "—"}
                  </span>
                  <span style={{ fontFamily: mono, fontSize: 11, color: "#525252", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {entry.email}
                  </span>
                  <span style={{ fontFamily: mono, fontSize: 11, color: "#525252" }}>
                    {PLAN_LABEL[entry.plan] ?? entry.plan}
                  </span>
                  <span style={{ fontFamily: mono, fontSize: 10, color: "#a3a3a3" }}>
                    {new Date(entry.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}
                  </span>
                  <span style={statusTag(entry.notified)}>
                    {entry.notified ? "SENT" : "PENDING"}
                  </span>
                  <div style={{ textAlign: "right" }}>
                    {!entry.notified && (
                      <button
                        onClick={() => notifyOne(entry.id)}
                        disabled={notifyingId === entry.id}
                        style={{ ...btn("primary"), padding: "5px 10px", fontSize: 10, opacity: notifyingId === entry.id ? 0.4 : 1 }}
                      >
                        {notifyingId === entry.id ? "…" : "SEND"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Discount Generator ── */}
        <div style={{ borderTop: "2px solid #111111", paddingTop: 36, marginBottom: 56 }}>
          <p style={{ ...sectionLabel }}>Discount Generator</p>
          <p style={{ fontFamily: sans, fontSize: 15, fontWeight: 600, color: "#111111", marginBottom: 24 }}>
            Generate &amp; send a personalised discount code
          </p>

          <form onSubmit={generateDiscount} style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 580, marginBottom: 36 }}>
            <div>
              <label style={{ display: "block", fontFamily: mono, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8a8a8a", marginBottom: 5 }}>
                Send to email
              </label>
              <input type="email" required value={genEmail} onChange={e => setGenEmail(e.target.value)} placeholder="name@example.com" style={inputStyle()} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 120px", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontFamily: mono, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8a8a8a", marginBottom: 5 }}>
                  Discount %
                </label>
                <input type="number" required min={5} max={100} value={genPercent} onChange={e => setGenPercent(Number(e.target.value))} style={inputStyle()} />
              </div>
              <div>
                <label style={{ display: "block", fontFamily: mono, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8a8a8a", marginBottom: 5 }}>
                  Plan
                </label>
                <select value={genPlan} onChange={e => setGenPlan(e.target.value)} style={{ ...inputStyle(), cursor: "pointer" }}>
                  {PLAN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontFamily: mono, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8a8a8a", marginBottom: 5 }}>
                  Expires (hrs)
                </label>
                <input type="number" required min={1} value={genExpiry} onChange={e => setGenExpiry(Number(e.target.value))} style={inputStyle()} />
              </div>
            </div>

            <button type="submit" disabled={genLoading} style={{ ...btn("primary"), alignSelf: "flex-start", opacity: genLoading ? 0.5 : 1, cursor: genLoading ? "wait" : "pointer" }}>
              {genLoading ? "SENDING…" : "GENERATE & SEND →"}
            </button>

            {genResult && "error" in genResult && (
              <p style={{ fontFamily: mono, fontSize: 11, color: "#ef4444", margin: 0 }}>✕ {genResult.error}</p>
            )}
            {genResult && "code" in genResult && (
              <div style={{ padding: "16px 20px", border: "1px solid #e5e5e5", background: "#f5f5f5" }}>
                <p style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#16a34a", margin: "0 0 6px" }}>
                  ✓ Discount sent to {genResult.email}
                </p>
                <p style={{ fontFamily: mono, fontSize: 20, fontWeight: 700, color: "#111111", margin: 0, letterSpacing: "0.06em" }}>
                  {genResult.code}
                </p>
              </div>
            )}
          </form>

          {/* Recent codes */}
          <p style={{ ...sectionLabel }}>Recent Codes</p>
          {codesLoading ? (
            <p style={{ fontFamily: mono, fontSize: 12, color: "#a3a3a3" }}>Loading…</p>
          ) : codes.length === 0 ? (
            <p style={{ fontFamily: mono, fontSize: 12, color: "#a3a3a3" }}>No codes yet.</p>
          ) : (
            <div style={{ border: "1px solid #e5e5e5", overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.8fr 50px 100px 1.5fr 140px 70px", gap: 0, background: "#f5f5f5", borderBottom: "1px solid #e5e5e5", padding: "7px 14px" }}>
                {["Code", "%", "Plan", "Sent To", "Expires", "Status"].map(h => (
                  <span key={h} style={tableHeader}>{h}</span>
                ))}
              </div>
              {codes.map((c, i) => {
                const st = codeStatus(c);
                return (
                  <div key={c.id} style={{ display: "grid", gridTemplateColumns: "1.8fr 50px 100px 1.5fr 140px 70px", gap: 0, padding: "9px 14px", borderBottom: i < codes.length - 1 ? "1px solid #f0f0f0" : "none", alignItems: "center" }}>
                    <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, color: "#111111" }}>{c.code}</span>
                    <span style={{ fontFamily: mono, fontSize: 12, color: "#525252" }}>{c.discount_percent}%</span>
                    <span style={{ fontFamily: mono, fontSize: 11, color: "#737373" }}>{c.plan_restriction ?? "All"}</span>
                    <span style={{ fontFamily: mono, fontSize: 11, color: "#525252", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.created_for_email ?? "—"}</span>
                    <span style={{ fontFamily: mono, fontSize: 10, color: "#a3a3a3" }}>
                      {c.expires_at ? new Date(c.expires_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                    </span>
                    <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, color: st.color }}>{st.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Customers ── */}
        <div style={{ borderTop: "2px solid #111111", paddingTop: 36, marginBottom: 56 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
            <div>
              <p style={{ ...sectionLabel }}>Customers</p>
              <p style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color: "#111111", margin: 0 }}>
                {custLoading ? "—" : customers.length}
              </p>
            </div>
            {!custLoading && customers.length > 0 && (
              <div style={{ display: "flex", gap: 0, border: "1px solid #e5e5e5" }}>
                {[
                  { label: "Active",    val: activeCustomers.length,  color: "#16a34a" },
                  { label: "Expired",   val: expiredCustomers.length, color: "#ef4444" },
                  { label: "~£" + mrr + "/mo", val: null, color: "#111111" },
                ].map((item, i, arr) => (
                  <div key={item.label} style={{ padding: "12px 20px", borderRight: i < arr.length - 1 ? "1px solid #e5e5e5" : "none", textAlign: "center" }}>
                    {item.val !== null && (
                      <div style={{ fontFamily: mono, fontSize: 20, fontWeight: 700, color: item.color }}>{item.val}</div>
                    )}
                    <div style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: item.val !== null ? "#8a8a8a" : item.color }}>
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button onClick={fetchCustomers} style={btn("ghost")}>↻</button>
          </div>

          {/* Filter tabs */}
          <div style={{ display: "flex", gap: 0, marginBottom: 16, border: "1px solid #e5e5e5" }}>
            {(["all", "active", "expired", "cancelled"] as CustFilter[]).map(f => (
              <button key={f} onClick={() => setCustFilter(f)} style={{ ...filterBtn(custFilter === f), borderWidth: 0, borderRight: "1px solid #e5e5e5" }}>
                {f.toUpperCase()}
              </button>
            ))}
          </div>

          {custLoading ? (
            <p style={{ fontFamily: mono, fontSize: 12, color: "#a3a3a3" }}>Loading…</p>
          ) : (() => {
            const filteredCust = custFilter === "all"
              ? customers
              : customers.filter(c => (c.plan_status || c.subscription_status) === custFilter);
            return filteredCust.length === 0 ? (
              <p style={{ fontFamily: mono, fontSize: 12, color: "#a3a3a3" }}>No customers.</p>
            ) : (
              <div style={{ border: "1px solid #e5e5e5", overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1.8fr 110px 80px 130px 130px 60px", gap: 0, background: "#f5f5f5", borderBottom: "1px solid #e5e5e5", padding: "7px 14px" }}>
                  {["Email", "Plan", "Status", "Started", "Expires", "Tools"].map(h => (
                    <span key={h} style={tableHeader}>{h}</span>
                  ))}
                </div>
                {filteredCust.map((c, i) => {
                  const status = c.plan_status || c.subscription_status || "active";
                  const toolCount = c.plan === "studio" || c.plan === "pro" ? 8 : 1;
                  return (
                    <div key={c.id} style={{ display: "grid", gridTemplateColumns: "1.8fr 110px 80px 130px 130px 60px", gap: 0, padding: "9px 14px", borderBottom: i < filteredCust.length - 1 ? "1px solid #f0f0f0" : "none", alignItems: "center" }}>
                      <span style={{ fontFamily: mono, fontSize: 11, color: "#525252", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.email}</span>
                      <span style={{ fontFamily: mono, fontSize: 11, color: "#111111" }}>{CUST_PLAN_LABEL[c.plan] ?? c.plan}</span>
                      <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: CUST_STATUS_COLOR[status] ?? "#8a8a8a", textTransform: "uppercase" }}>{status}</span>
                      <span style={{ fontFamily: mono, fontSize: 10, color: "#a3a3a3" }}>
                        {c.plan_started_at ? new Date(c.plan_started_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }) : "—"}
                      </span>
                      <span style={{ fontFamily: mono, fontSize: 10, color: "#a3a3a3" }}>
                        {c.plan_expires_at ? new Date(c.plan_expires_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }) : "—"}
                      </span>
                      <span style={{ fontFamily: mono, fontSize: 11, color: "#525252" }}>{toolCount}</span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* ── Education Access Requests ── */}
        <div style={{ borderTop: "2px solid #111111", paddingTop: 36, marginBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <p style={{ ...sectionLabel }}>Education Access</p>
              <p style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color: "#111111", margin: 0 }}>
                {edLoading ? "—" : edRequests.length}
                {!edLoading && newEdRequests > 0 && (
                  <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 400, color: "#a3a3a3", marginLeft: 12 }}>
                    {newEdRequests} new
                  </span>
                )}
              </p>
            </div>
            <button onClick={fetchEdRequests} style={btn("ghost")}>↻</button>
          </div>

          {edLoading ? (
            <p style={{ fontFamily: mono, fontSize: 12, color: "#a3a3a3" }}>Loading…</p>
          ) : edRequests.length === 0 ? (
            <p style={{ fontFamily: mono, fontSize: 12, color: "#a3a3a3" }}>No requests yet.</p>
          ) : (
            <div style={{ border: "1px solid #e5e5e5", overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 90px 1.2fr 60px 70px 90px 210px", gap: 0, background: "#f5f5f5", borderBottom: "1px solid #e5e5e5", padding: "7px 14px" }}>
                {["Name", "Type", "Email", "Students", "Status", "Date", "Actions"].map(h => (
                  <span key={h} style={tableHeader}>{h}</span>
                ))}
              </div>
              {edRequests.map((r, i) => {
                const actionable = r.status === "new" || r.status === "reviewed";
                return (
                <div
                  key={r.id}
                  title={r.message ?? undefined}
                  style={{ display: "grid", gridTemplateColumns: "1.2fr 90px 1.2fr 60px 70px 90px 210px", gap: 0, padding: "10px 14px", borderBottom: i < edRequests.length - 1 ? "1px solid #f0f0f0" : "none", alignItems: "center" }}
                >
                  <span style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: "#111111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.name}
                  </span>
                  <span style={{ fontFamily: mono, fontSize: 11, color: "#737373" }}>{r.type ?? "—"}</span>
                  <span style={{ fontFamily: mono, fontSize: 11, color: "#525252", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.email}</span>
                  <span style={{ fontFamily: mono, fontSize: 11, color: "#525252" }}>{r.students_count ?? "—"}</span>
                  <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, color: ED_STATUS_COLOR[r.status] ?? "#111111", textTransform: "uppercase" }}>
                    {r.status}
                  </span>
                  <span style={{ fontFamily: mono, fontSize: 10, color: "#a3a3a3" }}>
                    {new Date(r.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}
                  </span>
                  {actionable ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <select
                        value={edPlanChoice[r.id] ?? "studio"}
                        onChange={e => setEdPlanChoice(prev => ({ ...prev, [r.id]: e.target.value }))}
                        style={{ fontFamily: mono, fontSize: 10, padding: "5px 4px", border: "1px solid #e5e5e5" }}
                      >
                        <option value="studio">Studio</option>
                        <option value="pro">Pro</option>
                        <option value="single">Single</option>
                      </select>
                      <button
                        disabled={edActingId === r.id}
                        onClick={() => actOnEdRequest(r.id, "approve")}
                        style={{ ...btn("primary"), padding: "5px 9px", fontSize: 10 }}
                      >
                        {edActingId === r.id ? "…" : "Approve"}
                      </button>
                      <button
                        disabled={edActingId === r.id}
                        onClick={() => actOnEdRequest(r.id, "reject")}
                        style={{ ...btn("outline"), padding: "5px 9px", fontSize: 10 }}
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <span style={{ fontFamily: mono, fontSize: 10, color: "#a3a3a3" }}>—</span>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
