import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export async function GET(req: NextRequest) {
  // Vercel Cron sends "Authorization: Bearer $CRON_SECRET" automatically when CRON_SECRET
  // is set — it does not send a custom x-cron-secret header, so checking that header meant
  // this endpoint 401'd on every scheduled run and the cron never actually did anything.
  const auth = req.headers.get("Authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/ping`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": key,
      "Authorization": `Bearer ${key}`,
    },
    body: "{}",
  }).catch(() => null);

  // Fallback: plain SELECT 1 via SQL endpoint if rpc/ping doesn't exist
  if (!res || !res.ok) {
    await fetch(`${SUPABASE_URL}/rest/v1/waitlist?select=id&limit=1`, {
      headers: { "apikey": key, "Authorization": `Bearer ${key}` },
    }).catch(() => null);
  }

  return NextResponse.json({ status: "ok", timestamp: new Date() });
}
