import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ADMIN_EMAIL = "ceo@andykgroup.com";

async function requireAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email === ADMIN_EMAIL;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { protocol, host } = new URL(req.url);
  const res = await fetch(`${protocol}//${host}/api/waitlist/${id}`, {
    method: "POST",
    headers: { "x-admin-secret": process.env.ADMIN_SECRET! },
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
