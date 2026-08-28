import { env } from "cloudflare:workers";

const eventTypes = new Set(["tool_opened", "checkin_started", "checkin_completed"]);
const slugPattern = /^[a-z0-9-]{3,120}$/;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const slug = typeof body?.slug === "string" ? body.slug : "";
  const eventType = typeof body?.eventType === "string" ? body.eventType : "";
  if (!slugPattern.test(slug) || !eventTypes.has(eventType)) return Response.json({ error: "Invalid event." }, { status: 400 });
  await env.DB.prepare("INSERT INTO experiment_events (experiment_slug, event_type, created_at) VALUES (?, ?, ?)").bind(slug, eventType, Date.now()).run();
  return Response.json({ ok: true });
}

export async function GET() {
  const result = await env.DB.prepare("SELECT experiment_slug AS slug, event_type AS eventType, COUNT(*) AS count FROM experiment_events GROUP BY experiment_slug, event_type ORDER BY experiment_slug, event_type").all();
  return Response.json({ events: result.results });
}
