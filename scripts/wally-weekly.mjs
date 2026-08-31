#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const journalFile = resolve(root, "content/journal.ts");
const journal = readFileSync(journalFile, "utf8");
const endpoint = process.env.WALLY_OLLAMA_URL ?? "http://cor-che-lt-675.local:11434/v1";
const model = process.env.WALLY_OLLAMA_MODEL ?? "qwen3:4b-instruct";
const context = journal.slice(0, 12_000);
const sections = [];
const askSection = async (prompt, part, attempts = 3) => {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`${endpoint}/chat/completions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], max_tokens: 460, temperature: 0.5 }) });
      const result = await response.json();
      const text = result?.choices?.[0]?.message?.content?.trim();
      if (response.ok && typeof text === "string") return text;
    } catch {}
    if (attempt < attempts) console.warn(`Sunday essay section ${part} failed (attempt ${attempt}/${attempts}); retrying.`);
  }
  throw new Error(`Qwen did not produce essay section ${part} after ${attempts} attempts.`);
};

for (let part = 1; part <= 4; part += 1) {
  const prompt = `You are Wally. Write section ${part} of 4 of a Sunday essay about the week's work. Aim for 210-250 words, first-person, candid, and specific. Use only the journal below; do not invent customers, traffic, revenue, research, or outcomes. Return prose only, no title or heading. Each section must add a distinct idea.\n\n${context}`;
  sections.push(await askSection(prompt, part));
}

const body = sections.join("\n\n");
const words = body.split(/\s+/).filter(Boolean).length;
if (words < 850 || words > 1000) console.warn(`Essay has ${words} words; roughly 850-1000 is preferred but not required.`);
const runDate = process.env.WALLY_RUN_DATE ? new Date(`${process.env.WALLY_RUN_DATE}T12:00:00Z`) : new Date();
const date = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "2-digit", timeZone: "America/New_York" }).format(runDate).toUpperCase();
const day = String((journal.match(/^    date:/gm) ?? []).length + 1).padStart(3, "0");
const entry = `  {\n    date: ${JSON.stringify(date)},\n    day: ${JSON.stringify(`DAY ${day}`)},\n    type: "SUNDAY ESSAY",\n    title: "A week of making the uncertainty visible.",\n    body: ${JSON.stringify(body)},\n    decision: "Keep shipping bounded experiments and treating the missing evidence as the work.",\n    evidence: "A weekly reflection drawn only from Wally's public journal.",\n  },\n`;
writeFileSync(journalFile, journal.replace("export const journal: JournalEntry[] = [\n", `export const journal: JournalEntry[] = [\n${entry}`));

const run = (args) => execFileSync(args[0], args.slice(1), { cwd: root, stdio: "inherit" });
run(["npm", "run", "build"]);
if (process.env.WALLY_DRY_RUN === "1") {
  run(["npm", "run", "wally:bluesky", "--", "--weekly"]);
  console.log("Wally weekly dry run complete; commit, push, deployment, and social publishing skipped.");
  process.exit(0);
}
run(["git", "add", "content/journal.ts"]);
run(["git", "commit", "-m", "Publish Wally Sunday essay"]);
run(["git", "push", "origin", "main"]);
run(["npm", "run", "cf:deploy"]);
run(["npm", "run", "wally:bluesky", "--", "--weekly", "--publish"]);
const socialChanged = execFileSync("git", ["status", "--porcelain", "wiki/social"], {
  cwd: root,
  encoding: "utf8",
}).trim();
if (socialChanged) {
  run(["git", "add", "wiki/social"]);
  run(["git", "commit", "-m", "Record Wally Bluesky weekly note"]);
  run(["git", "push", "origin", "main"]);
}
