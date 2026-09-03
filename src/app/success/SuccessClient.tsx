"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type State = "loading" | "success" | "error";

export default function SuccessClient() {
  const [state, setState] = useState<State>("loading");
  const [planName, setPlanName] = useState("your plan");

  useEffect(() => {
    // localStorage (not sessionStorage) so this survives a closed/reopened tab or a
    // redirect that lands in a fresh browsing context — the Revolut webhook is now the
    // real source of truth for granting access either way (see webhook route), so this
    // call is a best-effort fast path for sending the welcome email promptly, not the
    // only way access gets linked.
    let orderId: string | null = null;
    try { orderId = localStorage.getItem("andyk_order_id"); } catch { /* ignore */ }

    if (!orderId) {
      // Direct visit, reload after cleanup, or lost storage — show success UI without
      // re-verification; the webhook has already (or will already) grant access.
      setState("success");
      return;
    }

    fetch("/api/notify/payment-success", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: orderId }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.plan_name) setPlanName(data.plan_name);
        setState(data.ok ? "success" : "error");
        if (data.ok) {
          try { localStorage.removeItem("andyk_order_id"); } catch { /* ignore */ }
        }
      })
      .catch(() => setState("error"));
  }, []);

  if (state === "loading") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8a8a8a" }}>
          Verifying payment…
        </p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div style={{ minHeight: "100vh", background: "#ffffff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", textAlign: "center" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#ef4444", marginBottom: 20, display: "block" }}>
          Verification Failed
        </span>
        <h1 style={{ fontFamily: "var(--font-sans)", fontSize: "clamp(1.4rem, 3vw, 2rem)", fontWeight: 700, color: "#111111", margin: "0 0 16px" }}>
          Payment could not be verified.
        </h1>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "#8a8a8a", maxWidth: 400, lineHeight: 1.7, margin: "0 0 36px" }}>
          If your payment was successful, please contact{" "}
          <a href="mailto:ceo@andykgroup.com" style={{ color: "#111111" }}>ceo@andykgroup.com</a>{" "}
          and we will activate your account manually.
        </p>
        <Link
          href="/#pricing"
          style={{ display: "inline-block", padding: "12px 28px", background: "#111111", color: "#ffffff", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none" }}
        >
          Back to Pricing →
        </Link>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", textAlign: "center" }}>

      {/* Check mark */}
      <div style={{ width: 64, height: 64, border: "2px solid #111111", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 40, flexShrink: 0 }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(0,0,0,0.38)", marginBottom: 20, display: "block" }}>
        Payment Confirmed
      </span>

      <h1 style={{ fontFamily: "var(--font-sans)", fontSize: "clamp(1.6rem, 4vw, 2.4rem)", fontWeight: 700, color: "#111111", lineHeight: 1.25, margin: "0 0 16px", maxWidth: 520 }}>
        Welcome to Andy&apos;K Music Lab
      </h1>

      <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, letterSpacing: "0.06em", color: "#525252", margin: "0 0 12px" }}>
        {planName} — access active
      </p>

      <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "#8a8a8a", maxWidth: 400, lineHeight: 1.7, margin: "0 0 48px" }}>
        Your access is now active. Create your account to access the tools. Use the same email address you used at checkout.
      </p>

      <div style={{ width: 48, height: 1, background: "#111111", marginBottom: 48 }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
        <Link
          href="/register?next=/client"
          style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "14px 36px", background: "#111111", color: "#ffffff", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", textDecoration: "none" }}
        >
          Create Your Account →
        </Link>
        <Link
          href="/client"
          style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "#8a8a8a", textDecoration: "none" }}
        >
          Already have an account? Go to Tools →
        </Link>
      </div>

      <p style={{ marginTop: 56, fontFamily: "var(--font-mono)", fontSize: 10, color: "#d4d4d4", letterSpacing: "0.06em" }}>
        A confirmation email has been sent to your inbox.
      </p>
    </div>
  );
}
