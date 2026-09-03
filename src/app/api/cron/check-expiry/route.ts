import { NextRequest, NextResponse } from "next/server";
import { expiryWarningHtml, expiryHtml } from "@/lib/email";
import { PLAN_LABELS } from "@/lib/access";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const FROM         = "noreply@andykgroup.com";

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
  }).catch(err => console.error("[check-expiry] email error", err));
}

type ProfileRow = {
  id: string;
  email: string;
  plan: string;
  plan_expires_at: string;
  plan_status: string;
  expiry_warning_sent: boolean;
};

export async function GET(req: NextRequest) {
  // Verify Vercel cron secret
  const auth = req.headers.get("Authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now     = new Date();
  const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const nowISO  = now.toISOString();

  let warningsSent = 0;
  let expiredUpdated = 0;

  // ── 1. Expiry warnings: expires within 7 days, warning not yet sent ─────────
  const warnRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?select=id,email,plan,plan_expires_at,plan_status,expiry_warning_sent` +
    `&plan_expires_at=lt.${encodeURIComponent(in7Days)}` +
    `&plan_expires_at=gt.${encodeURIComponent(nowISO)}` +
    `&expiry_warning_sent=eq.false` +
    `&plan_status=eq.active` +
    `&plan=not.is.null`,
    { headers: sbHeaders(), cache: "no-store" }
  );
  const warningRows: ProfileRow[] = warnRes.ok ? await warnRes.json() : [];

  for (const row of warningRows) {
    const planLabel = PLAN_LABELS[row.plan] ?? row.plan;
    await sendEmail(
      row.email,
      "Your Andy'K Music Lab access expires in 7 days",
      expiryWarningHtml(planLabel, row.plan_expires_at)
    );
    await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${row.id}`,
      {
        method: "PATCH",
        headers: { ...sbHeaders(), Prefer: "return=minimal" },
        body: JSON.stringify({ expiry_warning_sent: true }),
      }
    );
    warningsSent++;
  }

  // ── 2. Mark expired: plan_expires_at < now, plan_status still 'active' ──────
  const expiredRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?select=id,email,plan,plan_status` +
    `&plan_expires_at=lt.${encodeURIComponent(nowISO)}` +
    `&plan_status=eq.active` +
    `&plan=not.is.null`,
    { headers: sbHeaders(), cache: "no-store" }
  );
  const expiredRows: ProfileRow[] = expiredRes.ok ? await expiredRes.json() : [];

  for (const row of expiredRows) {
    // Update status
    await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${row.id}`,
      {
        method: "PATCH",
        headers: { ...sbHeaders(), Prefer: "return=minimal" },
        body: JSON.stringify({ plan_status: "expired", subscription_status: "expired" }),
      }
    );
    // Send expiry email
    const planLabel = PLAN_LABELS[row.plan] ?? row.plan;
    await sendEmail(
      row.email,
      "Your Andy'K Music Lab access has expired",
      expiryHtml(planLabel)
    );
    expiredUpdated++;
  }

  return NextResponse.json({ ok: true, warnings_sent: warningsSent, expired_updated: expiredUpdated });
}
