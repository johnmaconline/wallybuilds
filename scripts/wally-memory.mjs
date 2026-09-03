#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const date = process.env.WALLY_RUN_DATE ?? new Date().toISOString().slice(0, 10);
const nellyRoot = process.env.NELLY_ROOT ?? "/Users/johnmacdonald/code/other/nelly";
const conversationPath = resolve(root, "wiki/conversations", `${date}.md`);
if (!existsSync(conversationPath)) throw new Error(`Cannot update personal memory without wiki/conversations/${date}.md.`);

const readOptional = (path) => existsSync(path) ? readFileSync(path, "utf8") : "";
const conversation = readFileSync(conversationPath, "utf8");
const portfolio = readOptional(resolve(root, "wiki/portfolio", `${date}.md`));
const draftText = readOptional(resolve(root, "drafts", `${date}-wally-draft.json`));
let draft = {};
try { draft = draftText ? JSON.parse(draftText) : {}; } catch {}

const compact = (value, limit = 500) => {
  const normalized = String(value ?? "Not recorded.").replace(/\s+/g, " ").trim();
  return normalized.length <= limit ? normalized : `${normalized.slice(0, limit).replace(/\s+\S*$/, "")}…`;
};
const jsonField = (text, key) => {
  const match = text.match(new RegExp(`"${key}":\\s*("(?:\\\\.|[^"\\\\])*")`));
  if (!match) return undefined;
  try { return JSON.parse(match[1]); } catch { return undefined; }
};
const selected = compact(jsonField(conversation, "selected_direction"));
const concession = compact(conversation.match(/^\*\*Concession:\*\* (.+)$/m)?.[1]);
const openQuestion = compact(conversation.match(/^\*\*Question carried into the work:\*\* (.+)$/m)?.[1]);
const activeTitle = compact(portfolio.match(/^## Active build — (.+)$/m)?.[1] ?? draft?.fieldNote?.title);
const constraint = compact(portfolio.match(/^\*\*Philosophical tension:\*\* (.+)$/m)?.[1] ?? draft?.experiment?.philosophicalTension);
const decision = compact(draft?.fieldNote?.decision);
const evidence = compact(draft?.fieldNote?.evidence);

const selfRoot = resolve(root, "wiki/self");
const experienceDir = resolve(selfRoot, "experiences");
mkdirSync(experienceDir, { recursive: true });
const experiencePath = resolve(experienceDir, `${date}.md`);
const experience = `---
title: Wally experience ${date}
created: ${date}
type: agent-experience
sources:
  - wiki/conversations/${date}.md
  - wiki/portfolio/${date}.md
  - drafts/${date}-wally-draft.json
---

# Wally experience — ${date}

## What I actually did

- **Selected direction:** ${selected}
- **Active work:** ${activeTitle}
- **Decision:** ${decision}
- **Recorded evidence boundary:** ${evidence}

## What changed in my thinking

- **Concession I made:** ${concession}
- **Constraint carried into the work:** ${constraint}
- **Question left open by Nelly:** ${openQuestion}

## Memory boundary

This page records sourced agent experience. It does not verify factual claims inside the conversation or establish external demand, usefulness, or human experience.
`;
if (existsSync(experiencePath) && readFileSync(experiencePath, "utf8") !== experience) {
  throw new Error(`Wally experience ${date} is immutable and differs from the current sources.`);
}
if (!existsSync(experiencePath)) writeFileSync(experiencePath, experience);

const appendOnce = (path, marker, entry) => {
  const current = readFileSync(path, "utf8");
  if (!current.includes(marker)) writeFileSync(path, `${current.trimEnd()}\n${entry}`);
};
appendOnce(resolve(selfRoot, "index.md"), `[[experiences/${date}]]`, `- [[experiences/${date}]] — ${activeTitle}: ${selected}\n`);
appendOnce(resolve(selfRoot, "beliefs.md"), `## ${date}`, `\n## ${date}\n\n- **Provisional belief:** ${constraint}\n- **Why it entered memory:** ${concession}\n- **Source:** [[experiences/${date}]]\n- **Confidence:** provisional\n`);
appendOnce(resolve(selfRoot, "log.md"), `## ${date} — experience recorded`, `\n## ${date} — experience recorded\n\n- Added [[experiences/${date}]] from the dated conversation, portfolio, and draft.\n`);

const nellyResult = spawnSync(process.execPath, [resolve(nellyRoot, "scripts/nelly-memory.mjs")], {
  cwd: nellyRoot,
  input: JSON.stringify({ date, conversation, portfolio, draft }),
  encoding: "utf8",
  timeout: 30_000,
  maxBuffer: 2_000_000,
});
if (nellyResult.status !== 0) throw new Error(`Nelly memory update failed: ${(nellyResult.stderr || "unknown error").trim()}`);

const nellyChanges = execFileSync("git", ["status", "--porcelain", "wiki"], { cwd: nellyRoot, encoding: "utf8" }).trim();
if (nellyChanges) {
  execFileSync("git", ["add", "wiki"], { cwd: nellyRoot, stdio: "inherit" });
  execFileSync("git", ["commit", "-m", `Record Nelly experience ${date}`], { cwd: nellyRoot, stdio: "inherit" });
}
console.log(`Personal wikis updated for Wally and Nelly: ${date}.`);
