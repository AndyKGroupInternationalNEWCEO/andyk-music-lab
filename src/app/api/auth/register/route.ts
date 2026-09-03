import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { confirmSignupHtml } from "@/lib/email";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const APP_URL       = "https://lab.djandykofficial.com";
const FROM          = "noreply@andykgroup.com";

function sbHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` };
}

async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  }).catch(err => console.error("[register] confirmation email error", err));
}

export async function POST(req: NextRequest) {
  const { email, password, full_name, gdpr_consent } = await req.json().catch(() => ({}));
  if (!email || !password) return NextResponse.json({ error: "email and password required" }, { status: 400 });
  if (!gdpr_consent) return NextResponse.json({ error: "gdpr_consent required" }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "password must be at least 8 characters" }, { status: 400 });

  const emailLower = email.trim().toLowerCase();
  const supabase = createAdminClient();

  // Create the auth user UNCONFIRMED and get a one-time confirmation token in the same call.
  // Access (plan/tool_access) is deliberately NOT resolved here — it is only linked once the
  // email is verified (see /auth/confirm), so nobody can claim a paying customer's access by
  // registering with their email address before they do.
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "signup",
    email: emailLower,
    password,
    options: { data: { full_name: full_name?.trim() || null } },
  });

  if (error) {
    const status = /already|registered|exists/i.test(error.message) ? 409 : 500;
    return NextResponse.json({ error: status === 409 ? "An account with this email already exists." : error.message }, { status });
  }

  const user = data?.user;
  const hashedToken = data?.properties?.hashed_token;
  if (!user || !hashedToken) return NextResponse.json({ error: "user creation failed" }, { status: 500 });

  const now = new Date().toISOString();

  // Create (or refresh) the profile row so GDPR consent is recorded immediately,
  // even before the email is confirmed. No plan yet.
  await fetch(`${SUPABASE_URL}/rest/v1/profiles?on_conflict=id`, {
    method: "POST",
    headers: { ...sbHeaders(), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      id: user.id,
      email: emailLower,
      full_name: full_name?.trim() || null,
      gdpr_consent: true,
      gdpr_consent_at: now,
    }),
  });

  const confirmUrl = `${APP_URL}/auth/confirm?token_hash=${encodeURIComponent(hashedToken)}&type=signup&next=${encodeURIComponent("/client")}`;

  await sendEmail(
    emailLower,
    "Confirm your email — Andy'K Music Lab",
    confirmSignupHtml(confirmUrl)
  );

  return NextResponse.json({ ok: true, needsConfirmation: true });
}
