"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/lib/translations";
import type { User } from "@supabase/supabase-js";

function Initials({ user }: { user: User }) {
  const name = user.user_metadata?.full_name as string | undefined;
  const text = name
    ? name.split(/\s+/).map((w: string) => w[0]).join("").slice(0, 2)
    : (user.email?.[0] ?? "?");
  return (
    <div style={{
      width: 28, height: 28, background: "#111111",
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "#ffffff", textTransform: "uppercase" }}>
        {text.toUpperCase()}
      </span>
    </div>
  );
}

export default function Navbar() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const { locale, setLocale, t } = useLanguage();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then((res: { data: { user: User | null } }) => setUser(res.data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: string, session: { user: User } | null) => {
        setUser(session?.user ?? null);
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    router.push("/");
    router.refresh();
  };

  return (
    <nav className="premium-nav">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link href="/" className="flex items-center flex-shrink-0" onClick={() => setMenuOpen(false)}>
          <span className="logo-brand">Andy&apos;K</span>
          <span className="logo-pipe">|</span>
          <span className="logo-name">Music Lab</span>
        </Link>

        {/* Center nav — desktop */}
        <div className="hidden md:flex items-center gap-1">
          <Link href="/#tools" className="nav-link">{t.nav.tools}</Link>
          <Link href="/#pricing" className="nav-link">{t.nav.pricing}</Link>
          <a href="https://djandykofficial.com" target="_blank" rel="noopener noreferrer" className="nav-link">{t.nav.about}</a>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Language select */}
          <select
            value={locale}
            onChange={e => setLocale(e.target.value as Locale)}
            aria-label="Select language"
            style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", background: "transparent", border: "1px solid rgba(0,0,0,0.18)", color: "#111111", padding: "3px 6px", cursor: "pointer", outline: "none", borderRadius: 4 }}
          >
            <option value="en">EN</option>
            <option value="sk">SK</option>
            <option value="de">DE</option>
            <option value="es">ES</option>
          </select>

          {/* Auth state — desktop */}
          {user ? (
            <Link
              href="/client"
              className="hidden sm:flex items-center gap-2"
              style={{ textDecoration: "none" }}
            >
              <Initials user={user} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#111111" }}>
                My Lab →
              </span>
            </Link>
          ) : (
            <Link
              href="/login"
              className="hidden sm:block"
              style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#111111", textDecoration: "none" }}
            >
              Sign In
            </Link>
          )}

          {/* Hamburger — mobile */}
          <button
            className="md:hidden theme-toggle-btn"
            onClick={() => setMenuOpen(o => !o)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            <span className={`hamburger-wrap ${menuOpen ? "open" : ""}`}>
              <span className="hamburger-line" />
              <span className="hamburger-line" />
              <span className="hamburger-line" />
            </span>
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="md:hidden mobile-nav-menu">
          <Link href="/#tools" className="mobile-nav-link" onClick={() => setMenuOpen(false)}>{t.nav.tools}</Link>
          <Link href="/#pricing" className="mobile-nav-link" onClick={() => setMenuOpen(false)}>{t.nav.pricing}</Link>
          <a href="https://djandykofficial.com" target="_blank" rel="noopener noreferrer" className="mobile-nav-link" onClick={() => setMenuOpen(false)}>{t.nav.about} ↗</a>
          <div style={{ height: 1, background: "rgba(0,0,0,0.08)", margin: "6px 12px" }} />

          {user ? (
            <>
              <Link href="/client" className="mobile-nav-link" style={{ fontWeight: 700 }} onClick={() => setMenuOpen(false)}>My Lab →</Link>
              <button
                onClick={() => { handleSignOut(); setMenuOpen(false); }}
                className="mobile-nav-link"
                style={{ textAlign: "left", background: "none", border: "none", cursor: "pointer", width: "100%", color: "var(--color-muted)", fontSize: 14, padding: "10px 16px" }}
              >
                Sign Out
              </button>
            </>
          ) : (
            <Link href="/login" className="mobile-nav-link" onClick={() => setMenuOpen(false)}>Sign In</Link>
          )}

          <div style={{ display: "flex", gap: 8, padding: "8px 16px" }}>
            {(["en", "sk", "de", "es"] as Locale[]).map(l => (
              <button
                key={l}
                onClick={() => { setLocale(l); setMenuOpen(false); }}
                style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", background: locale === l ? "#111111" : "transparent", color: locale === l ? "#ffffff" : "#525252", border: "1px solid rgba(0,0,0,0.15)", borderRadius: 4, padding: "3px 8px", cursor: "pointer" }}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
