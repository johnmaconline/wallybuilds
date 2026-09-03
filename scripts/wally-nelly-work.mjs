#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const nellyRoot = process.env.NELLY_ROOT ?? "/Users/johnmacdonald/code/other/nelly";
const date = process.env.WALLY_RUN_DATE ?? new Date().toISOString().slice(0, 10);
const draftPath = resolve(root, "drafts", `${date}-wally-draft.json`);
let source;
if (existsSync(draftPath)) {
  const draft = JSON.parse(readFileSync(draftPath, "utf8"));
  const artifacts = readdirSync(resolve(root, "public/experiments")).filter((file) => file.startsWith(`${date}-`) && file.endsWith(".html"));
  if (artifacts.length !== 1) throw new Error(`Expected exactly one ${date} experiment artifact; found ${artifacts.length}.`);
  const artifactPath = `public/experiments/${artifacts[0]}`;
  const artifact = readFileSync(resolve(root, artifactPath), "utf8");
  if (!artifact.trim()) throw new Error(`Verified artifact ${artifactPath} is empty.`);
  source = {
    title: draft?.fieldNote?.title, path: `wallybuilds:${artifactPath}`,
    decision: draft?.fieldNote?.decision, evidence: draft?.fieldNote?.evidence,
    artifact_bytes: Buffer.byteLength(artifact), artifact_text: artifact.slice(0, 20_000),
  };
} else {
  const journal = readFileSync(resolve(root, "content/journal.ts"), "utf8");
  const dateLabel = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "2-digit", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)).toUpperCase();
  const start = journal.indexOf(`date: ${JSON.stringify(dateLabel)}`);
  const end = journal.indexOf("\n  },", start);
  if (start < 0 || end < 0) throw new Error(`Nelly cannot find a built artifact for ${date}.`);
  const entry = journal.slice(start, end);
  const field = (key) => { const match = entry.match(new RegExp(`${key}:\\s*("(?:\\\\.|[^"\\\\])*")`)); return match ? JSON.parse(match[1]) : undefined; };
  source = {
    title: field("title"), path: "wallybuilds:content/journal.ts",
    decision: field("decision"), evidence: field("evidence"),
    artifact_bytes: Buffer.byteLength(entry), artifact_text: entry,
  };
}

const result = spawnSync(process.execPath, [resolve(nellyRoot, "scripts/nelly-work.mjs")], {
  cwd: nellyRoot,
  input: JSON.stringify({
    date,
    source,
  }),
  encoding: "utf8",
  timeout: 420_000,
  maxBuffer: 2_000_000,
  env: { ...process.env },
});
if (result.status !== 0) throw new Error(`Nelly Boundary Atlas failed: ${(result.stderr || "unknown error").trim()}`);
const output = JSON.parse(result.stdout);
if (output?.status !== "published") throw new Error("Nelly did not report a published Atlas case.");

const changes = execFileSync("git", ["status", "--porcelain", "work/boundary-atlas"], { cwd: nellyRoot, encoding: "utf8" }).trim();
if (changes && process.env.WALLY_DRY_RUN !== "1") {
  execFileSync("git", ["add", "work/boundary-atlas"], { cwd: nellyRoot, stdio: "inherit" });
  execFileSync("git", ["commit", "-m", `Publish Boundary Atlas case ${date}`], { cwd: nellyRoot, stdio: "inherit" });
  execFileSync("git", ["push", "origin", "main"], { cwd: nellyRoot, stdio: "inherit" });
}
console.log(`Nelly Boundary Atlas complete: ${output.path}`);
