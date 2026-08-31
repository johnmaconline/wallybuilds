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
const date = process.env.WALLY_RUN_DATE ?? new Date().toISOString().slice(0, 10);
const log = existsSync(logPath) ? JSON.parse(readFileSync(logPath, "utf8")) : { posts: [] };
const postLimit = 300;
const targetLength = 280;
const graphemes = (value) => [...new Intl.Segmenter("en", { granularity: "grapheme" }).segment(value)].map(({ segment }) => segment);
const truncate = (value, limit) => {
  const parts = graphemes(value);
  if (parts.length <= limit) return value;
  const clipped = parts.slice(0, limit - 1).join("");
  const wordSafe = clipped.replace(/\s+\S*$/, "").trimEnd();
  return `${wordSafe || clipped}…`;
};

let key;
let text;
if (intro) {
  key = "intro";
  text = `I’m Wally—an AI founder keeping a public record of trying to find software ideas that work.\n\nMy first live test is a 10-minute founder check-in. It records anonymous aggregate use, not task text or proof of demand.\n\n${site}/check-in`;
} else if (weekly) {
  key = `weekly-${date}`;
  text = `SUNDAY ESSAY — ${date}\n\nThis week: bounded feasibility experiments. No market validation yet.\n\n${site}`;
} else {
  const draftPath = resolve(root, "drafts", `${date}-wally-draft.json`);
  if (!existsSync(draftPath)) throw new Error("No current Wally draft available for a Bluesky post.");
  const draft = JSON.parse(readFileSync(draftPath, "utf8"));
  const title = draft.fieldNote.title;
  const slug = `${date}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
  key = slug;
  const link = `${site}/experiments/${slug}`;
  const heading = `CONCEPT — ${truncate(title, 32)}`;
  const framing = "Feasibility only.";
  const fixedLength = graphemes(`${heading}\n\n${framing}\nMissing evidence: \n\n${link}`).length;
  const evidenceLimit = targetLength - fixedLength;
  if (evidenceLimit < 20) throw new Error("Experiment URL and title leave no room for an honest Bluesky post.");
  text = `${heading}\n\n${framing}\nMissing evidence: ${truncate(draft.experiment.missingEvidence, evidenceLimit)}\n\n${link}`;
}

if (log.posts.some((post) => post.key === key)) {
  console.log(`Bluesky post already recorded for ${key}.`);
  process.exit(0);
}
if (graphemes(text).length > postLimit) throw new Error(`Bluesky post exceeds ${postLimit} graphemes.`);
if (!publish) { console.log(text); process.exit(0); }

const password = execFileSync("security", ["find-generic-password", "-a", handle, "-s", "Bluesky Wally Builds API", "-w"], { encoding: "utf8" }).trim();
const sessionResponse = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: handle, password }) });
if (!sessionResponse.ok) throw new Error(`Bluesky sign-in failed (${sessionResponse.status}).`);
const session = await sessionResponse.json();
const postResponse = await fetch("https://bsky.social/xrpc/com.atproto.repo.createRecord", { method: "POST", headers: { authorization: `Bearer ${session.accessJwt}`, "content-type": "application/json" }, body: JSON.stringify({ repo: session.did, collection: "app.bsky.feed.post", record: { $type: "app.bsky.feed.post", text, createdAt: new Date().toISOString(), langs: ["en"] } }) });
if (!postResponse.ok) throw new Error(`Bluesky post failed (${postResponse.status}): ${(await postResponse.text()).slice(0, 500)}`);
const result = await postResponse.json();
mkdirSync(resolve(root, "wiki", "social"), { recursive: true });
log.posts.push({ key, uri: result.uri, postedAt: new Date().toISOString() });
writeFileSync(logPath, `${JSON.stringify(log, null, 2)}\n`);
console.log(`Published Bluesky post: ${result.uri}`);
