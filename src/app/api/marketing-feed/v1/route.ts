import { createHash } from "node:crypto";
import { buildMarketingFeed, signFeedBody } from "@/lib/marketing-feed";

// Read-only public product facts for the Marketing Studio. No database access, no customer data.
export async function GET(request: Request) {
  const body = JSON.stringify(buildMarketingFeed());
  const etag = `"${createHash("sha256").update(body).digest("hex").slice(0, 32)}"`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
    ETag: etag,
    "X-Robots-Tag": "noindex",
  };
  const secret = process.env.MARKETING_FEED_SIGNING_SECRET;
  if (secret) headers["X-Feed-Signature"] = signFeedBody(body, secret);
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  return new Response(body, { headers });
}
