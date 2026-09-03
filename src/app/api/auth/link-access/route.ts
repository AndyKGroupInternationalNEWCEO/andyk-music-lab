import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { linkPendingAccessToUser } from "@/lib/access";

// Called after login — links any ungranted pending_access (Revolut payment or an
// approved education-access request) to an existing account.
export async function POST() {
  // Auth is verified server-side from session cookies — email never trusted from client
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ ok: false, linked: false });

  const result = await linkPendingAccessToUser(user.id, user.email);
  return NextResponse.json({ ok: true, linked: result.linked, plan_name: result.planLabel });
}
