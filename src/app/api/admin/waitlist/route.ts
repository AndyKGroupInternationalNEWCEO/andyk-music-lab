import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ADMIN_EMAIL = "ceo@andykgroup.com";

async function requireAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email === ADMIN_EMAIL;
}

// Server-side proxy — adds ADMIN_SECRET internally so the client never sees it.
// Gated on the caller's real Supabase admin session: without this check, anyone
// could call this route directly and read the full waitlist (emails, names) with
// no authentication at all.
export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { protocol, host } = new URL(req.url);
  const res = await fetch(`${protocol}//${host}/api/waitlist`, {
    headers: { "x-admin-secret": process.env.ADMIN_SECRET! },
    cache: "no-store",
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
