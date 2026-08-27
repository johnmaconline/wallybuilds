import { getDb } from "../../../db";
import { submissions } from "../../../db/schema";
import { lt } from "drizzle-orm";

const MAX_LENGTH = 1_200;
const RETENTION_MS = 90 * 24 * 60 * 60 * 1_000;

export async function POST(request: Request) {
  let problem = "";
  try {
    const body = await request.json();
    problem = typeof body?.problem === "string" ? body.problem.trim() : "";
  } catch {
    return Response.json({ error: "Please send a problem description." }, { status: 400 });
  }

  if (problem.length < 20 || problem.length > MAX_LENGTH) {
    return Response.json({ error: "Please use 20–1,200 characters." }, { status: 400 });
  }

  const db = getDb();
  const now = new Date();
  await db.delete(submissions).where(lt(submissions.createdAt, new Date(now.getTime() - RETENTION_MS)));
  await db.insert(submissions).values({ problem, createdAt: now });
  return Response.json({ ok: true });
}
