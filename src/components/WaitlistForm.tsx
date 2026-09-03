"use client";

import { useState } from "react";


export type WaitlistPlan = "single" | "studio" | "pro";

const PLAN_LABELS: Record<WaitlistPlan, string> = {
  single: "Single Session (£79 one-time)",
  studio: "Studio Pass (£49/month)",
  pro:    "Pro Pass (£199/year)",
};

interface Props {
  initialPlan?: WaitlistPlan;
  onClose: () => void;
  onSuccess?: () => void;
}

type Status = "idle" | "submitting" | "success" | "duplicate" | "error";

export default function WaitlistForm({ initialPlan = "studio", onClose, onSuccess }: Props) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [plan, setPlan] = useState<WaitlistPlan>(initialPlan);
  const [status, setStatus] = useState<Status>("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("submitting");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          name: name.trim() || null,
          plan,
        }),
      });

      if (res.ok) {
        setStatus("success");
        onSuccess?.();
      } else if (res.status === 409) {
        setStatus("duplicate");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 14px", borderRadius: 10,
    border: "1px solid var(--color-grid-500)",
    background: "var(--color-grid-300)",
    color: "var(--color-foreground)",
    fontSize: 14, outline: "none", boxSizing: "border-box",
    fontFamily: "var(--font-sans)",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 11, fontFamily: "var(--font-mono)",
    letterSpacing: "0.1em", textTransform: "uppercase",
    color: "var(--color-muted-2)", marginBottom: 6,
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10000,
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div className="glass-card" style={{
        width: "100%", maxWidth: 440, borderRadius: 20, padding: 36, position: "relative",
        background: "var(--color-background)",
      }}>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute", top: 14, right: 14,
            background: "none", border: "none", cursor: "pointer",
            color: "var(--color-muted-2)", fontSize: 22, lineHeight: 1,
            padding: "2px 6px", borderRadius: 6,
          }}
        >×</button>

        {status === "success" ? (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ fontSize: 44, marginBottom: 14 }}>✓</div>
            <h3 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--color-foreground)", marginBottom: 10 }}>
              You&apos;re on the waitlist!
            </h3>
            <p style={{ fontSize: 14, color: "var(--color-muted)", lineHeight: 1.65 }}>
              We&apos;ll contact you when {PLAN_LABELS[plan]} access opens.
            </p>
            <button
              onClick={onClose}
              style={{ marginTop: 24, padding: "10px 28px", borderRadius: 10, background: "#111111", color: "#fff", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}
            >
              Done
            </button>
          </div>
        ) : status === "duplicate" ? (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ fontSize: 44, marginBottom: 14 }}>📋</div>
            <h3 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--color-foreground)", marginBottom: 10 }}>
              Already on the list!
            </h3>
            <p style={{ fontSize: 14, color: "var(--color-muted)" }}>
              You&apos;re already on the waitlist. We&apos;ll be in touch soon!
            </p>
            <button
              onClick={onClose}
              style={{ marginTop: 24, padding: "10px 28px", borderRadius: 10, background: "#111111", color: "#fff", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <p style={{ fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-muted-2)", marginBottom: 16 }}>
              Early Access
            </p>
            <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--color-foreground)", marginBottom: 6 }}>
              Join the Waitlist
            </h2>
            <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 24, lineHeight: 1.65 }}>
              Be the first to access Andy&apos;K Music Lab when we open.
            </p>

            {/* Plan */}
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Plan</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(["single", "studio", "pro"] as WaitlistPlan[]).map(p => (
                  <button
                    key={p} type="button" onClick={() => setPlan(p)}
                    style={{
                      padding: "6px 13px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                      border: `1px solid ${plan === p ? "#111111" : "var(--color-grid-500)"}`,
                      background: plan === p ? "#111111" : "transparent",
                      color: plan === p ? "#fff" : "var(--color-muted)",
                      cursor: "pointer", transition: "all 0.15s ease",
                    }}
                  >
                    {p === "single" ? "£79 one-time" : p === "studio" ? "£49/mo" : "£199/yr"}
                  </button>
                ))}
              </div>
            </div>

            {/* Email */}
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Email <span style={{ color: "var(--color-muted-2)" }}>*</span></label>
              <input
                type="email" required value={email}
                onChange={e => { setEmail(e.target.value); if (status === "error") setStatus("idle"); }}
                placeholder="you@example.com"
                style={inputStyle}
              />
            </div>

            {/* Name */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ ...labelStyle }}>
                Name <span style={{ opacity: 0.5, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
              </label>
              <input
                type="text" value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
                style={inputStyle}
              />
            </div>

            {status === "error" && (
              <p style={{ fontSize: 12, color: "#ef4444", marginBottom: 14 }}>
                Something went wrong. Please try again.
              </p>
            )}

            <button
              type="submit"
              disabled={status === "submitting"}
              style={{
                width: "100%", padding: "13px", borderRadius: 12,
                background: "#111111", color: "#fff",
                fontSize: 14, fontWeight: 700, border: "none",
                cursor: status === "submitting" ? "not-allowed" : "pointer",
                opacity: status === "submitting" ? 0.65 : 1,
                transition: "opacity 0.15s ease",
              }}
            >
              {status === "submitting" ? "Joining…" : "Join Waitlist →"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
