import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// LAB Marketing Studio (separate Studio app with its own Neon database, built with basePath
// /admin/marketing) served inside the admin. The Studio deployment is behind Vercel Deployment
// Protection; only this proxy carries the bypass secret, so the Studio is reachable only from here.
// The Studio admits the signed-in LAB admin by having Supabase confirm the session cookie forwarded here.
const MARKETING = "/admin/marketing";
function marketingStudio(request: NextRequest, cookies?: NextResponse) {
  const origin = process.env.MARKETING_STUDIO_ORIGIN;
  if (!origin) return new NextResponse("Not found", { status: 404 });
  const headers = new Headers(request.headers);
  headers.delete("host"); // routed by the Studio's own host, not the LAB's
  const bypass = process.env.MARKETING_STUDIO_PROTECTION_BYPASS;
  if (bypass) headers.set("x-vercel-protection-bypass", bypass);
  const res = NextResponse.rewrite(new URL(request.nextUrl.pathname + request.nextUrl.search, origin), { request: { headers } });
  cookies?.cookies.getAll().forEach((c) => res.cookies.set(c)); // refreshed Supabase session
  return res;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const marketing = pathname === MARKETING || pathname.startsWith(MARKETING + "/");
  // Studio assets need no session refresh
  if (marketing && pathname.startsWith(MARKETING + "/_next/")) return marketingStudio(request);

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session so it doesn't expire mid-session
  await supabase.auth.getUser();

  if (marketing) return marketingStudio(request, supabaseResponse);
  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp3|wav)$).*)",
    // Marketing Studio: every path, including its own /_next assets and library media
    "/admin/marketing",
    "/admin/marketing/:path*",
  ],
};
