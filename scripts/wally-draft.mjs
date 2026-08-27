#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const date = new Date().toISOString().slice(0, 10);
const sources = [
  "WALLY.md",
  "wiki/index.md",
  "wiki/identity.md",
  "wiki/experiments/first-hypothesis.md",
  "content/journal.ts",
];

const context = sources
  .map((file) => `--- ${file} ---\n${readFileSync(resolve(root, file), "utf8")}`)
  .join("\n\n");

const prompt = `You are Wally, an AI founder. Use only the supplied project context below. Do not claim web research, traffic, customers, revenue, or actions not present in the context. Propose a bounded experiment that can be done inside this repository. Return JSON only, with this exact shape:\n{"experiment":{"targetUser":"...","test":"...","successCondition":"...","missingEvidence":"..."},"fieldNote":{"title":"...","body":"220-260 words exactly, first-person, candid","decision":"...","evidence":"..."}}\nThe body must be 220-260 words; count carefully. Do not reuse the existing journal entry's title, body, decision, or evidence; this must be a new entry that moves the work forward.\n\n${context}`;

let output;
try {
  output = execFileSync(
    "hermes",
    ["--in", root, "-z", prompt],
    { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], maxBuffer: 1024 * 1024 },
  ).trim();
} catch {
  process.exitCode = 1;
  throw new Error("Hermes did not produce a draft.");
}

const json = output.match(/\{[\s\S]*\}/)?.[0];
if (!json) throw new Error("Hermes response was not JSON; no draft was written.");

let draft;
try {
  draft = JSON.parse(json);
} catch {
  throw new Error("Hermes returned invalid JSON; no draft was written.");
}

const bodyPrompt = `You are Wally. Write only the body of a FIELD NOTE: 240-270 words, first-person, candid, specific, and with no heading or quotation marks. Do not claim web research, traffic, customers, revenue, or completed actions that are not in this experiment. Make clear that this is a hypothesis and that evidence is missing. Do not reuse wording from the existing journal. Whenever you mention a concrete public source or artifact, use a Markdown hyperlink. Link only to a verified URL or site anchor supplied in the context; do not invent destinations.\n\nExperiment: ${JSON.stringify(draft.experiment)}\n\nExisting project context:\n${context}`;
try {
  const endpoint = process.env.WALLY_OLLAMA_URL ?? "http://cor-che-lt-675.local:11434/v1";
  const model = process.env.WALLY_OLLAMA_MODEL ?? "qwen3:4b-instruct";
  const response = await fetch(`${endpoint}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: bodyPrompt }],
      max_tokens: 420,
      temperature: 0.5,
    }),
  });
  const completion = await response.json();
  if (!response.ok || typeof completion?.choices?.[0]?.message?.content !== "string") {
    throw new Error("Ollama returned no usable field-note body.");
  }
  draft.fieldNote.body = completion.choices[0].message.content.trim();
} catch {
  throw new Error("The local Qwen endpoint did not produce the field-note body.");
}

const required = [
  draft?.experiment?.targetUser,
  draft?.experiment?.test,
  draft?.experiment?.successCondition,
  draft?.experiment?.missingEvidence,
  draft?.fieldNote?.title,
  draft?.fieldNote?.body,
  draft?.fieldNote?.decision,
  draft?.fieldNote?.evidence,
];
const words = String(draft?.fieldNote?.body ?? "").trim().split(/\s+/).filter(Boolean).length;
const missingFields = required.filter((value) => typeof value !== "string" || !value.trim()).length;
const duplicatesExisting = context.includes(draft?.fieldNote?.body) || context.includes(draft?.fieldNote?.title);
if (missingFields || words < 200 || words > 300 || duplicatesExisting) {
  throw new Error(`Draft failed validation (${missingFields} missing fields; ${words} body words; duplicate: ${duplicatesExisting}). No draft was written.`);
}

const outputDir = resolve(root, "drafts");
mkdirSync(outputDir, { recursive: true });
const outputFile = resolve(outputDir, `${date}-wally-draft.json`);
writeFileSync(outputFile, `${JSON.stringify({ date, sources, ...draft }, null, 2)}\n`);
console.log(`Draft written: ${outputFile}`);
