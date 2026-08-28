#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const date = new Date().toISOString().slice(0, 10);
const sources = [
  "WALLY.md",
  "wiki/index.md",
  "wiki/identity.md",
  "wiki/experiments/first-hypothesis.md",
  "wiki/feedback/latest.md",
  "content/journal.ts",
];

const context = sources
  .map((file) => `--- ${file} ---\n${readFileSync(resolve(root, file), "utf8")}`)
  .join("\n\n");

const prompt = `You are Wally, an AI founder. Use only the supplied project context below. Generate an inward-facing idea and a bounded repository-only feasibility experiment. Do not claim web research, citations, submissions, traffic, customers, revenue, or actions not present in the context. Return JSON only, with this exact shape:\n{"experiment":{"targetUser":"...","test":"...","successCondition":"...","missingEvidence":"..."},"fieldNote":{"title":"...","body":"220-260 words exactly, first-person, candid","decision":"...","evidence":"..."}}\nThe body must be 220-260 words; count carefully. Do not reuse the existing journal entry's title, body, decision, or evidence; this must be a new entry that moves the work forward.\n\n${context}`;

const endpoint = process.env.WALLY_OLLAMA_URL ?? "http://cor-che-lt-675.local:11434/v1";
const model = process.env.WALLY_OLLAMA_MODEL ?? "qwen3:4b-instruct";
const askQwen = async (content, max_tokens) => {
  const response = await fetch(`${endpoint}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content }], max_tokens, temperature: 0.5 }),
  });
  const completion = await response.json();
  if (!response.ok || typeof completion?.choices?.[0]?.message?.content !== "string") {
    throw new Error("The configured Qwen endpoint returned no usable response.");
  }
  return completion.choices[0].message.content.trim();
};

const output = await askQwen(prompt, 700);

const json = output.match(/\{[\s\S]*\}/)?.[0];
if (!json) throw new Error("Hermes response was not JSON; no draft was written.");

let draft;
try {
  draft = JSON.parse(json);
} catch {
  throw new Error("Hermes returned invalid JSON; no draft was written.");
}

const bodyPrompt = `You are Wally. Write only the body of a FIELD NOTE: 240-270 words, first-person, candid, specific, and with no heading or quotation marks. Use 4-7 short paragraphs separated by exactly one blank line; do not produce a wall of text. This is an inward-generated feasibility experiment, not market validation. Do not mention or claim web research, citations, submissions, traffic, customers, revenue, or completed external actions. State plainly that external evidence is absent. Do not reuse wording from the existing journal.\n\nExperiment: ${JSON.stringify(draft.experiment)}\n\nExisting project context:\n${context}`;
try {
  draft.fieldNote.body = await askQwen(bodyPrompt, 420);
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
const unsupportedClaim = /https?:|github|submission|customer|traffic|revenue|interview|validated|market signal/i.test(`${draft.fieldNote.title} ${draft.fieldNote.body} ${draft.fieldNote.decision} ${draft.fieldNote.evidence}`);
const paragraphCount = String(draft?.fieldNote?.body ?? "").trim().split(/\n\s*\n+/).filter(Boolean).length;
if (missingFields || words < 200 || words > 300 || paragraphCount < 4 || paragraphCount > 7 || duplicatesExisting || unsupportedClaim) {
  throw new Error(`Draft failed validation (${missingFields} missing fields; ${words} body words; duplicate: ${duplicatesExisting}). No draft was written.`);
}

const outputDir = resolve(root, "drafts");
mkdirSync(outputDir, { recursive: true });
const outputFile = resolve(outputDir, `${date}-wally-draft.json`);
writeFileSync(outputFile, `${JSON.stringify({ date, sources, ...draft }, null, 2)}\n`);
console.log(`Draft written: ${outputFile}`);
