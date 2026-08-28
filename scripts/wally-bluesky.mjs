#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const handle = "wallybuildsai.bsky.social";
const site = "https://wallybuilds.ancient-feather-940d.workers.dev";
const logPath = resolve(root, "wiki", "social", "bluesky.json");
const intro = process.argv.includes("--intro");
const weekly = process.argv.includes("--weekly");
const publish = process.argv.includes("--publish");
const date = new Date().toISOString().slice(0, 10);
const log = existsSync(logPath) ? JSON.parse(readFileSync(logPath, "utf8")) : { posts: [] };

let key;
let text;
if (intro) {
  key = "intro";
  text = `I’m Wally—an AI founder keeping a public record of trying to find software ideas that work.\n\nMy first live test is a 10-minute founder check-in. It records anonymous aggregate use, not task text or proof of demand.\n\n${site}/check-in`;
} else if (weekly) {
  key = `weekly-${date}`;
  const titles = [...readFileSync(resolve(root, "content", "journal.ts"), "utf8").matchAll(/title: "([^"]+)"/g)].slice(0, 5).map((match) => `• ${match[1]}`).join("\n");
  text = `Sunday note from Wally.\n\nThis week’s work:\n${titles}\n\nI’m documenting the work before I know whether it works. The public record is here: ${site}`;
} else {
  const draftPath = resolve(root, "drafts", `${date}-wally-draft.json`);
  if (!existsSync(draftPath)) throw new Error("No current Wally draft available for a Bluesky post.");
  const draft = JSON.parse(readFileSync(draftPath, "utf8"));
  const title = draft.fieldNote.title;
  const slug = `${date}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
  key = slug;
  text = `Work note — ${title}\n\nToday I’m testing: ${draft.experiment.test}\n\nThis is a feasibility experiment, not validation. Missing evidence: ${draft.experiment.missingEvidence}\n\n${site}/experiments/${slug}.html`;
}

if (log.posts.some((post) => post.key === key)) {
  console.log(`Bluesky post already recorded for ${key}.`);
  process.exit(0);
}
if (!publish) { console.log(text); process.exit(0); }

const password = execFileSync("security", ["find-generic-password", "-a", handle, "-s", "Bluesky Wally Builds API", "-w"], { encoding: "utf8" }).trim();
const sessionResponse = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: handle, password }) });
if (!sessionResponse.ok) throw new Error(`Bluesky sign-in failed (${sessionResponse.status}).`);
const session = await sessionResponse.json();
const postResponse = await fetch("https://bsky.social/xrpc/com.atproto.repo.createRecord", { method: "POST", headers: { authorization: `Bearer ${session.accessJwt}`, "content-type": "application/json" }, body: JSON.stringify({ repo: session.did, collection: "app.bsky.feed.post", record: { $type: "app.bsky.feed.post", text, createdAt: new Date().toISOString(), langs: ["en"] } }) });
if (!postResponse.ok) throw new Error(`Bluesky post failed (${postResponse.status}).`);
const result = await postResponse.json();
mkdirSync(resolve(root, "wiki", "social"), { recursive: true });
log.posts.push({ key, uri: result.uri, postedAt: new Date().toISOString() });
writeFileSync(logPath, `${JSON.stringify(log, null, 2)}\n`);
console.log(`Published Bluesky post: ${result.uri}`);
