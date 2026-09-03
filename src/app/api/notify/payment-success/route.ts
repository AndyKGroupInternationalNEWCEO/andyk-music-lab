import { NextRequest, NextResponse } from "next/server";
import { paymentSuccessHtml } from "@/lib/email";
import { PLAN_LABELS } from "@/lib/access";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const FROM = "noreply@andykgroup.com";

function sbHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` };
}

async function sendEmail(to: string, planLabel: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from: FROM,
      to,
      subject: "Welcome to Andy'K Music Lab — Your access is ready",
      html: paymentSuccessHtml(planLabel),
    }),
  });
}

export async function POST(req: NextRequest) {
  const { order_id } = await req.json().catch(() => ({}));
  if (!order_id) {
    return NextResponse.json({ error: "order_id required" }, { status: 400 });
  }

  let email: string | null = null;
  let planKey = "";
  let termsAccepted: boolean | undefined;
  let termsAt: string | null | undefined;
  let termsVersion: string | null | undefined;

  if ((order_id as string).startsWith("free_")) {
    // Free order — no Revolut order exists; read plan/email from pending_access
    const paRes = await fetch(
      `${SUPABASE_URL}/rest/v1/pending_access?order_id=eq.${encodeURIComponent(order_id)}&select=plan,email&limit=1`,
      { headers: sbHeaders(), cache: "no-store" }
    );
    const paRows: { plan: string; email: string }[] = paRes.ok ? await paRes.json() : [];
    if (!paRows.length) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    planKey = paRows[0].plan ?? "";
    email = paRows[0].email || null;
    // terms already stored in pending_access at order creation — leave undefined to skip in upsert
  } else {
    const secret = process.env.REVOLUT_SECRET_KEY;
    if (!secret) return NextResponse.json({ error: "Revolut not configured" }, { status: 500 });

    // 1. Verify order with Revolut server-side — never trust client-supplied plan/email
    const revolut = await fetch(`https://merchant.revolut.com/api/orders/${order_id}`, {
      headers: {
        Authorization: `Bearer ${secret}`,
        "Revolut-Api-Version": "2024-09-01",
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!revolut.ok) {
      console.error("[payment-success] Revolut order fetch failed", revolut.status);
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const order = await revolut.json();

    // 2. Verify order is actually completed
    if (order.state !== "COMPLETED") {
      return NextResponse.json({ error: "Order not completed", state: order.state }, { status: 402 });
    }

    // 3. Extract email and plan from Revolut order — all from trusted source
    email = order.email ?? order.customer?.email ?? order.metadata?.email ?? null;
    planKey = order.metadata?.plan ?? "";
    termsAccepted = order.metadata?.accepted_pricing_terms === "true";
    termsAt = order.metadata?.accepted_pricing_terms_at ?? null;
    termsVersion = order.metadata?.accepted_pricing_terms_version ?? null;
  }

  const planLabel = PLAN_LABELS[planKey] ?? "Music Lab Access";

  // 4. Upsert pending_access (idempotent by order_id) regardless of email availability
  if (planKey) {
    await fetch(
      `${SUPABASE_URL}/rest/v1/pending_access?on_conflict=order_id`,
      {
        method: "POST",
        headers: { ...sbHeaders(), Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({
          email: email?.trim().toLowerCase() ?? "",
          plan: planKey,
          order_id,
          status: "paid",
          access_granted: false,
          ...(termsAccepted !== undefined && { accepted_pricing_terms: termsAccepted }),
          ...(termsAt !== undefined && { accepted_pricing_terms_at: termsAt }),
          ...(termsVersion !== undefined && { accepted_pricing_terms_version: termsVersion }),
          updated_at: new Date().toISOString(),
        }),
      }
    );
  }

  if (!email) {
    return NextResponse.json({ ok: true, plan_name: planLabel, email_sent: false });
  }

  const emailLower = email.trim().toLowerCase();

  // 5. Dedup — check waitlist to avoid double-sending
  const waitlistRes = await fetch(
    `${SUPABASE_URL}/rest/v1/waitlist?email=eq.${encodeURIComponent(emailLower)}&select=id,paid_email_sent&limit=1`,
    { headers: sbHeaders(), cache: "no-store" }
  );

  const waitlistRows: { id: string; paid_email_sent: boolean }[] = waitlistRes.ok ? await waitlistRes.json() : [];
  if (waitlistRows.length > 0 && waitlistRows[0].paid_email_sent) {
    return NextResponse.json({ ok: true, plan_name: planLabel, already_sent: true });
  }

  // 6. Send welcome email
  await sendEmail(emailLower, planLabel);

  // 7. Mark paid_email_sent in waitlist if present
  if (waitlistRows.length > 0) {
    await fetch(
      `${SUPABASE_URL}/rest/v1/waitlist?email=eq.${encodeURIComponent(emailLower)}`,
      {
        method: "PATCH",
        headers: { ...sbHeaders(), Prefer: "return=minimal" },
        body: JSON.stringify({ paid_email_sent: true }),
      }
    );
  }

  return NextResponse.json({ ok: true, plan_name: planLabel, email_sent: true });
}
