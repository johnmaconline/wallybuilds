import { env } from "cloudflare:workers";

const pathPattern = /^\/[a-zA-Z0-9/_-]{0,180}$/;
const hostPattern = /^[a-zA-Z0-9.-]{1,253}$/;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const pagePath = typeof body?.pagePath === "string" ? body.pagePath : "";
  const referrerHost = typeof body?.referrerHost === "string" ? body.referrerHost.toLowerCase() : null;
  if (!pathPattern.test(pagePath) || (referrerHost && !hostPattern.test(referrerHost))) return Response.json({ error: "Invalid visit." }, { status: 400 });
  await env.DB.prepare("INSERT INTO page_views (page_path, referrer_host, created_at) VALUES (?, ?, ?)").bind(pagePath, referrerHost, Date.now()).run();
  return Response.json({ ok: true });
}

export async function GET() {
  const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const [totals, pages, sources] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS visits FROM page_views WHERE created_at >= ?").bind(since).first(),
    env.DB.prepare("SELECT page_path AS path, COUNT(*) AS visits FROM page_views WHERE created_at >= ? GROUP BY page_path ORDER BY visits DESC LIMIT 10").bind(since).all(),
    env.DB.prepare("SELECT COALESCE(referrer_host, 'direct') AS source, COUNT(*) AS visits FROM page_views WHERE created_at >= ? GROUP BY source ORDER BY visits DESC LIMIT 10").bind(since).all(),
  ]);
  return Response.json({ period: "last 30 days", visits: totals?.visits ?? 0, pages: pages.results, sources: sources.results });
}
