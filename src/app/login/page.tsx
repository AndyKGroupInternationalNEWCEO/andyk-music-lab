"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  background: "#fafafa",
  border: "1px solid #e5e5e5",
  borderRadius: 0,
  color: "#111111",
  fontSize: 14,
  fontFamily: "var(--font-sans)",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  fontFamily: "var(--font-mono)",
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "#8a8a8a",
  marginBottom: 6,
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(
    searchParams.get("confirm_error") === "1"
      ? "That confirmation link is invalid or has expired. Please sign in, or register again to get a new one."
      : ""
  );
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (authError) {
      setError(
        /confirm/i.test(authError.message)
          ? "Please confirm your email address first — check your inbox for the confirmation link."
          : "Invalid email or password."
      );
      setLoading(false);
    } else {
      // Check for unlinked pending payment access and activate it
      let linked = false;
      try {
        const linkRes = await fetch("/api/auth/link-access", { method: "POST" });
        const linkData = await linkRes.json().catch(() => ({}));
        linked = linkData.linked === true;
      } catch { /* non-critical */ }
      router.push(linked ? "/client?payment=success" : "/client");
      router.refresh();
    }
  };

  return (
    <div style={{
      minHeight: "calc(100vh - 64px)",
      background: "#ffffff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "48px 24px",
    }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#8a8a8a", marginBottom: 20 }}>
          Andy&apos;K Music Lab
        </p>

        <h1 style={{ fontSize: "clamp(1.8rem,4vw,2.4rem)", fontWeight: 700, color: "#111111", lineHeight: 1.15, margin: "0 0 40px", fontFamily: "var(--font-sans)" }}>
          Sign In
        </h1>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={inputStyle}
              autoComplete="email"
            />
          </div>

          <div>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={inputStyle}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p style={{ fontSize: 13, color: "#ef4444", margin: 0 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "14px",
              background: loading ? "#525252" : "#111111",
              color: "#ffffff",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              border: "none",
              borderRadius: 0,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "background 0.15s ease",
            }}
          >
            {loading ? "Signing in…" : "Sign In →"}
          </button>
        </form>

        <div style={{ height: 1, background: "#e5e5e5", margin: "32px 0" }} />

        <p style={{ fontSize: 13, color: "#8a8a8a", fontFamily: "var(--font-sans)", margin: 0 }}>
          Don&apos;t have an account?{" "}
          <Link href="/register" style={{ color: "#111111", fontWeight: 600, textDecoration: "underline" }}>
            Create one →
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
