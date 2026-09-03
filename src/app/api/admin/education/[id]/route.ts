import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { educationApprovedHtml } from "@/lib/email";
import { PLAN_TOOLS, PLAN_LABELS, linkPendingAccessToUser } from "@/lib/access";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ADMIN_EMAIL  = "ceo@andykgroup.com";
const FROM         = "noreply@andykgroup.com";

function sbHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` };
}

async function requireAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email === ADMIN_EMAIL;
}

async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  }).catch(err => console.error("[admin/education approve] email error", err));
}

type EducationRequest = {
  id: string;
  name: string;
  email: string;
  status: string;
  accepted_pricing_terms: boolean | null;
  accepted_pricing_terms_at: string | null;
  accepted_pricing_terms_version: string | null;
};

// Approves (or rejects) a Limited Education Access request. Approving upserts a
// pending_access row (order_id = "edu_<request id>") the same way a Revolut payment
// does, so the exact same register/link-access code path grants tool_access and no
// admin ever touches the database directly. Idempotent — re-approving an already
// granted request is a no-op (checked via pending_access.access_granted, not by
// trusting education_access_requests.status, since that field is informational only).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { action, plan } = await req.json().catch(() => ({}));

  if (action === "reject") {
    await fetch(`${SUPABASE_URL}/rest/v1/education_access_requests?id=eq.${id}`, {
      method: "PATCH",
      headers: { ...sbHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify({ status: "rejected" }),
    });
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  if (!plan || !PLAN_TOOLS[plan as keyof typeof PLAN_TOOLS]) {
    return NextResponse.json({ error: "Valid plan required" }, { status: 400 });
  }

  const reqRes = await fetch(
    `${SUPABASE_URL}/rest/v1/education_access_requests?id=eq.${id}&select=*&limit=1`,
    { headers: sbHeaders(), cache: "no-store" }
  );
  if (!reqRes.ok) return NextResponse.json({ error: "Failed to load request" }, { status: 500 });
  const [request]: EducationRequest[] = await reqRes.json();
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Education access still requires the same Pricing & Access Terms acceptance as a
  // paid checkout — the submission form already enforces this, but never trust that
  // an old/unvalidated row can be approved without it.
  if (request.accepted_pricing_terms !== true) {
    return NextResponse.json({ error: "Request never accepted the Pricing & Access Terms" }, { status: 400 });
  }

  const orderId = `edu_${id}`;
  const emailLower = request.email.trim().toLowerCase();

  // Idempotency check — has this exact request already been granted?
  const existingRes = await fetch(
    `${SUPABASE_URL}/rest/v1/pending_access?order_id=eq.${encodeURIComponent(orderId)}&select=access_granted&limit=1`,
    { headers: sbHeaders(), cache: "no-store" }
  );
  const existing: { access_granted: boolean }[] = existingRes.ok ? await existingRes.json() : [];
  const alreadyGranted = existing[0]?.access_granted === true;

  await fetch(`${SUPABASE_URL}/rest/v1/pending_access?on_conflict=order_id`, {
    method: "POST",
    headers: { ...sbHeaders(), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      order_id: orderId,
      plan,
      status: "approved",
      access_granted: false,
      email: emailLower,
      accepted_pricing_terms: request.accepted_pricing_terms,
      accepted_pricing_terms_at: request.accepted_pricing_terms_at,
      accepted_pricing_terms_version: request.accepted_pricing_terms_version,
      updated_at: new Date().toISOString(),
    }),
  });

  await fetch(`${SUPABASE_URL}/rest/v1/education_access_requests?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...sbHeaders(), Prefer: "return=minimal" },
    body: JSON.stringify({ status: "accepted" }),
  });

  if (!alreadyGranted) {
    // If the requester already has an account, apply immediately rather than waiting
    // for their next login/confirm to pick up the pending_access row.
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(emailLower)}&select=id&limit=1`,
      { headers: sbHeaders(), cache: "no-store" }
    );
    const profiles: { id: string }[] = profileRes.ok ? await profileRes.json() : [];
    if (profiles.length > 0) {
      await linkPendingAccessToUser(profiles[0].id, emailLower);
    }

    const planLabel = PLAN_LABELS[plan] ?? plan;
    await sendEmail(
      emailLower,
      "Your Education Access has been approved — Andy'K Music Lab",
      educationApprovedHtml(planLabel)
    );
  }

  return NextResponse.json({ ok: true, status: "accepted", already_granted: alreadyGranted });
}
