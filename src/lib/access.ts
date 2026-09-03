// Single source of truth for plan → tool grants, plan expiry, and plan display labels.
// Used by register, link-access, the Revolut webhook, and education-access approval so
// they can never drift from each other (a tool missing from one copy silently breaks
// access for that plan).

export const PLAN_TOOLS: Record<string, string[]> = {
  single:          ["mastering"],
  studio:          ["mastering", "bpm", "planner", "track-comparator", "chord-generator", "metronome", "loudness-meter", "stem-splitter"],
  pro:             ["mastering", "bpm", "planner", "track-comparator", "chord-generator", "metronome", "loudness-meter", "stem-splitter", "audio-converter"],
  tool_mastering:  ["mastering"],
  tool_bpm:        ["bpm"],
  tool_planner:    ["planner"],
  tool_comparator: ["track-comparator"],
  tool_chord:      ["chord-generator"],
  tool_metronome:  ["metronome"],
  tool_loudness:   ["loudness-meter"],
  tool_stems:      ["stem-splitter"],
};

export const PLAN_LABELS: Record<string, string> = {
  single:          "Single Session",
  studio:          "Studio Pass",
  pro:             "Pro Pass",
  tool_mastering:  "Mastering Tool",
  tool_bpm:        "BPM + Key Detector",
  tool_planner:    "DJ Set Planner",
  tool_comparator: "Track Comparator",
  tool_chord:      "Chord Generator",
  tool_metronome:  "Metronome",
  tool_loudness:   "Loudness Meter",
  tool_stems:      "Stem Splitter",
};

export function planExpiry(plan: string, fromDate: number = Date.now()): string | null {
  if (plan === "pro") return new Date(fromDate + 365 * 24 * 60 * 60 * 1000).toISOString();
  if (plan === "studio" || plan.startsWith("tool_"))
    return new Date(fromDate + 30 * 24 * 60 * 60 * 1000).toISOString();
  return null; // single = lifetime access to that one session, no expiry
}

// ── Server-only helpers (service-role REST calls) ──────────────────────────
// Shared by register, link-access, /auth/confirm and education-access approval
// so "how do we turn a pending payment/approval into real tool_access rows" only
// exists in one place.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

function sbHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` };
}

export type PendingAccessRow = {
  id: string;
  plan: string;
  order_id: string | null;
  email: string;
};

// Most-recent ungranted pending_access row for an email (payment or education approval).
export async function findPendingAccess(email: string): Promise<PendingAccessRow | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/pending_access?email=eq.${encodeURIComponent(email)}&access_granted=eq.false&order=created_at.desc&limit=1`,
    { headers: sbHeaders(), cache: "no-store" }
  );
  if (!res.ok) return null;
  const rows: PendingAccessRow[] = await res.json();
  return rows[0] ?? null;
}

export async function markPendingAccessGranted(id: string): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/pending_access?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...sbHeaders(), Prefer: "return=minimal" },
    body: JSON.stringify({ access_granted: true, updated_at: new Date().toISOString() }),
  });
}

// Idempotent — safe to call more than once for the same user/tool (e.g. repeated
// webhook delivery, or a user re-confirming). Relies on the tool_access
// (user_id, tool_name) unique index (see supabase/migrations) to dedupe.
export async function grantToolAccess(userId: string, plan: string, planExpiresAt: string | null): Promise<void> {
  const tools = PLAN_TOOLS[plan];
  if (!tools?.length) return;
  const now = new Date().toISOString();
  await fetch(`${SUPABASE_URL}/rest/v1/tool_access?on_conflict=user_id,tool_name`, {
    method: "POST",
    headers: { ...sbHeaders(), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(tools.map(tool_name => ({
      user_id: userId, tool_name, granted_at: now, expires_at: planExpiresAt,
    }))),
  });
}

// Applies a matching pending_access row (Revolut payment or approved education
// request) to a real, authenticated user: updates their profile plan and grants
// the tool rows. Called after registration email confirmation and after login.
export async function linkPendingAccessToUser(
  userId: string,
  email: string
): Promise<{ linked: boolean; plan?: string; planLabel?: string }> {
  const pending = await findPendingAccess(email.toLowerCase());
  if (!pending) return { linked: false };

  const now = new Date().toISOString();
  const planExpiresAt = planExpiry(pending.plan);

  await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: "PATCH",
    headers: { ...sbHeaders(), Prefer: "return=minimal" },
    body: JSON.stringify({
      plan: pending.plan,
      plan_started_at: now,
      plan_expires_at: planExpiresAt,
      subscription_status: "active",
      plan_status: "active",
      access_source: pending.order_id?.startsWith("edu_") ? "education_approval" : "revolut_payment",
      revolut_order_id: pending.order_id,
    }),
  });

  await grantToolAccess(userId, pending.plan, planExpiresAt);
  await markPendingAccessGranted(pending.id);

  return { linked: true, plan: pending.plan, planLabel: PLAN_LABELS[pending.plan] ?? pending.plan };
}
