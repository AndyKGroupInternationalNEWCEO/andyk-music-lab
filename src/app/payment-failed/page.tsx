import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Payment Unsuccessful — Andy'K Music Lab",
  robots: { index: false, follow: false },
};

export default function PaymentFailedPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#ffffff", fontFamily: "var(--font-sans, sans-serif)" }}>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "80px 24px 64px" }}>

        {/* Label */}
        <p style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#ef4444", margin: "0 0 20px" }}>
          Payment Unsuccessful
        </p>

        {/* Heading */}
        <h1 style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)", fontWeight: 700, color: "#111111", letterSpacing: "-0.02em", lineHeight: 1.2, margin: "0 0 20px" }}>
          Don&apos;t worry — it happens.
        </h1>

        {/* Body */}
        <p style={{ fontSize: 16, color: "#525252", lineHeight: 1.75, margin: "0 0 56px", maxWidth: 520 }}>
          Your payment was not completed. No charge was made to your account.
        </p>

        <div style={{ height: 1, background: "#e5e5e5", marginBottom: 56 }} />

        {/* Why payments fail */}
        <div style={{ marginBottom: 48 }}>
          <p style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#8a8a8a", margin: "0 0 20px" }}>
            Why Payments Fail
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 0, border: "1px solid #e5e5e5" }}>
            {[
              ["Insufficient funds",              "Check your account balance before retrying."],
              ["Card declined by bank",           "Contact your bank to authorise online or international payments."],
              ["3D Secure / authentication failed","Check your banking app — you may have a pending approval request."],
              ["Card expired",                    "Check your card expiry date and use a valid card."],
              ["Incorrect card details",          "Double-check the card number, expiry date, and CVV."],
              ["Browser issue",                   "Try a different browser or clear your browser cache."],
              ["VPN or ad blocker active",        "Disable temporarily — these can block payment scripts."],
              ["Card not enabled for online use", "Contact your bank to enable online or e-commerce payments."],
            ].map(([reason, detail], i, arr) => (
              <div
                key={reason}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1.4fr",
                  gap: 0,
                  padding: "14px 20px",
                  borderBottom: i < arr.length - 1 ? "1px solid #f0f0f0" : "none",
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: "#111111", paddingRight: 16 }}>{reason}</span>
                <span style={{ fontSize: 13, color: "#737373", lineHeight: 1.55 }}>{detail}</span>
              </div>
            ))}
          </div>
        </div>

        {/* What to try */}
        <div style={{ marginBottom: 56 }}>
          <p style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#8a8a8a", margin: "0 0 20px" }}>
            What to Try
          </p>
          <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              "Try again with the same card.",
              "Try a different card or payment method — Revolut Pay, Apple Pay, or Google Pay.",
              "Check your banking app — you may need to approve the payment.",
              "Disable VPN or ad blocker and retry.",
              "Clear your browser cache and cookies, then try again.",
              "Try a different browser (Chrome, Safari, or Firefox).",
            ].map((item) => (
              <li key={item} style={{ fontSize: 14, color: "#525252", lineHeight: 1.65 }}>{item}</li>
            ))}
          </ol>
        </div>

        {/* CTAs */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 48 }}>
          <Link
            href="/#pricing"
            style={{
              display: "inline-block",
              padding: "14px 28px",
              background: "#111111",
              color: "#ffffff",
              fontFamily: "var(--font-mono, monospace)",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              textDecoration: "none",
              borderRadius: 0,
            }}
          >
            Try Again →
          </Link>
          <a
            href="mailto:ceo@andykgroup.com"
            style={{
              display: "inline-block",
              padding: "14px 28px",
              background: "transparent",
              color: "#111111",
              fontFamily: "var(--font-mono, monospace)",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              textDecoration: "none",
              border: "1px solid #111111",
              borderRadius: 0,
            }}
          >
            Contact Support →
          </a>
        </div>

        {/* Footer note */}
        <p style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 10, color: "#a3a3a3", letterSpacing: "0.06em", lineHeight: 1.7 }}>
          Payments are processed securely by Revolut Business. Andy&apos;K Music Lab does not store your card details.
        </p>

      </div>
    </div>
  );
}
