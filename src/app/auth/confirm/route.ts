import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { linkPendingAccessToUser } from "@/lib/access";
import type { EmailOtpType } from "@supabase/supabase-js";

const APP_URL = "https://lab.djandykofficial.com";
const ALLOWED_TYPES: EmailOtpType[] = ["signup", "email", "recovery", "invite", "magiclink", "email_change"];

// Completes Supabase email confirmation (signup, or a resent link) and, on success,
// links any pending Revolut payment or approved education request to the now-verified
// account — mirroring /api/auth/link-access so returning-via-email and returning-via-login
// both go through the same grant logic.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tokenHash = searchParams.get("token_hash");
  const typeParam = searchParams.get("type");
  const next = searchParams.get("next") ?? "/client";

  const type: EmailOtpType | null = ALLOWED_TYPES.includes(typeParam as EmailOtpType) ? (typeParam as EmailOtpType) : null;

  if (!tokenHash || !type) {
    return NextResponse.redirect(`${APP_URL}/login?confirm_error=1`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    return NextResponse.redirect(`${APP_URL}/login?confirm_error=1`);
  }

  const { data: { user } } = await supabase.auth.getUser();
  let linked = false;
  if (user?.email) {
    const result = await linkPendingAccessToUser(user.id, user.email);
    linked = result.linked;
  }

  const dest = new URL(next.startsWith("/") ? next : "/client", APP_URL);
  if (linked) dest.searchParams.set("payment", "success");
  return NextResponse.redirect(dest);
}
