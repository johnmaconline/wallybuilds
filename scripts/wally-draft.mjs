#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { readPublicJournalContext } from "./wally-context.mjs";
import { wallyOllamaModel as model, wallyOllamaUrl as endpoint } from "./wally-model.mjs";

const root = resolve(import.meta.dirname, "..");
const date = process.env.WALLY_RUN_DATE ?? new Date().toISOString().slice(0, 10);
const sources = [
  "WALLY.md",
  "wiki/index.md",
  "wiki/identity.md",
  "wiki/experiments/first-hypothesis.md",
  "wiki/feedback/latest.md",
  "wiki/portfolio/current.md",
  "content/journal.ts",
];
const conversation = `wiki/conversations/${date}.md`;
if (existsSync(resolve(root, conversation))) sources.splice(-1, 0, conversation);
const existingJournal = readFileSync(resolve(root, "content/journal.ts"), "utf8");
const currentPortfolio = readFileSync(resolve(root, "wiki/portfolio/current.md"), "utf8");
const activeBuildTitle = currentPortfolio.match(/^## Active build — (.+)$/m)?.[1]?.trim();
const activeBuildTask = currentPortfolio.match(/^\*\*Today:\*\* (.+)$/m)?.[1]?.trim();
const activeBuildSuccess = currentPortfolio.match(/^\*\*Success condition:\*\* (.+)$/m)?.[1]?.trim();
const activeBuildMissing = currentPortfolio.match(/^\*\*Missing evidence:\*\* (.+)$/m)?.[1]?.trim();
const activeBuildTension = currentPortfolio.match(/^\*\*Philosophical tension:\*\* (.+)$/m)?.[1]?.trim();

let context = sources
  .map((file) => `--- ${file} ---\n${file === "content/journal.ts" ? readPublicJournalContext(root) : readFileSync(resolve(root, file), "utf8")}`)
  .join("\n\n");
context += "\n\nIf a Wally–Nelly conversation is present, explain how one philosophical tension materially changed the experiment's design, constraint, or evidence boundary. Describe it only as internal agent reasoning, never as user feedback or market evidence.";

const prompt = `You are Wally, an AI founder. Use only the supplied project context below. Generate the active-build experiment from today's portfolio; do not start a second product. The discovery and distribution lanes are separate repository work and must not be represented as completed external research or marketing. Let the portfolio's philosophical tension materially constrain the test or its evidence boundary. Do not claim web research, citations, submissions, traffic, customers, revenue, or actions not present in the context. Return JSON only, with this exact shape:\n{"experiment":{"targetUser":"...","test":"...","successCondition":"...","missingEvidence":"..."},"fieldNote":{"title":"...","decision":"...","evidence":"..."}}\nDo not include the field-note body; it is generated separately. Do not reuse the existing journal entry's title, decision, or evidence; this must be a new entry that moves the work forward.\n\n${context}`;

const askQwen = async (content, max_tokens, json = false) => {
  const response = await fetch(`${endpoint}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content }], max_tokens, temperature: 0.5, ...(json ? { response_format: { type: "json_object" } } : {}) }),
  });
  const completion = await response.json();
  if (!response.ok || typeof completion?.choices?.[0]?.message?.content !== "string") {
    throw new Error("The configured Qwen endpoint returned no usable response.");
  }
  return completion.choices[0].message.content.trim();
};

const extractJsonObject = (value) => {
  const start = value.indexOf("{");
  if (start < 0) return undefined;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < value.length; index += 1) {
    const character = value[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{") depth += 1;
    else if (character === "}" && --depth === 0) return value.slice(start, index + 1);
  }
  return undefined;
};

const output = await askQwen(prompt, 500, true);

const json = extractJsonObject(output);
if (!json) throw new Error("Hermes response was not JSON; no draft was written.");

let draft;
try {
  draft = JSON.parse(json);
} catch (error) {
  throw new Error(`Hermes returned invalid JSON (${error.message}). Response: ${JSON.stringify(output.slice(0, 1000))}`);
}

// The portfolio owns selection. The prose model may interpret the work, but it
// may not silently replace the selected artifact or its evidence boundary.
draft.experiment = {
  targetUser: "Builders evaluating a bounded repository prototype",
  test: activeBuildTask,
  successCondition: activeBuildSuccess,
  missingEvidence: activeBuildMissing,
  philosophicalTension: activeBuildTension,
};
draft.fieldNote.title = activeBuildTitle;
draft.fieldNote.decision = `Build the selected repository artifact while preserving this internal constraint: ${activeBuildTension}`;
draft.fieldNote.evidence = "A dated repository artifact and passing test or build can establish technical feasibility. The Wally–Nelly dialogue shaped the constraint but is not evidence.";

const bodyPrompt = `You are Wally. Write only the body of a FIELD NOTE: roughly 250 words, first-person, candid, specific, and with no heading or quotation marks. Length is a layout guideline, not a gate. Use 4-7 short paragraphs separated by exactly one blank line; do not produce a wall of text. Stay on the exact experiment below; do not substitute another artifact, file, test, or source. Describe what the artifact will contain, what its named success condition can verify after the pipeline completes, what remains unknown, and the next decision. Do not claim compilation, test cases, HTTP results, or files beyond the supplied experiment. Include one concise passage explaining how the Wally–Nelly philosophical tension changed a design choice or evidence boundary; identify it as internal debate, not evidence. This is an inward-generated feasibility experiment, not market validation. Do not mention or claim web research, citations, submissions, traffic, customers, revenue, or completed external actions. State plainly that external evidence is absent. Never describe a mental walkthrough or imagined interaction. Do not mention coffee/email/planning/walking/writing, a green progress bar, 20–100% progress, or a weekly completion card. Do not reuse wording, scenarios, or conclusions from the existing journal.\n\nExperiment: ${JSON.stringify(draft.experiment)}\nPhilosophical tension: ${activeBuildTension}\n\nExisting project context:\n${context}`;
try {
  draft.fieldNote.body = await askQwen(bodyPrompt, 420);
} catch {
  throw new Error("The local Qwen endpoint did not produce the field-note body.");
}

const repeatsOldWalkthrough = /in (?:my|the) (?:head|mind)|mental (?:simulation|walkthrough)|green bar|20%.*,.*40%|coffee,? email,? planning|weekly (?:card|summary card)|I (?:watched|saw) (?:it|the .*?) work/i.test(draft.fieldNote.body);
const repeatsOldMetadata = existingJournal.includes(draft.fieldNote.decision) || existingJournal.includes(draft.fieldNote.evidence);
const omitsPhilosophicalInfluence = !/Wally|Nelly|internal (?:debate|dialogue)|philosophical tension/i.test(draft.fieldNote.body);
const generatedParagraphCount = String(draft.fieldNote.body).trim().split(/\n\s*\n+/).filter(Boolean).length;
const hasUnsupportedClaim = (text) => /https?:|github|market signal|(?:submissions?|customers?|traffic|revenue|interviews?).{0,35}(?:received|show(?:s|ed)?|increas(?:e|ed)|confirm(?:s|ed)?|found|conducted|completed|exists?)/i.test(text);
const hasInventedTechnicalResult = (text) => /\b(?:I built|I created|compiled successfully|no runtime errors|no syntax issues|passes? \d+ test|test cases? pass|HTTP 200)\b/i.test(text);
const generatedText = `${draft.fieldNote.title} ${draft.fieldNote.body} ${draft.fieldNote.decision} ${draft.fieldNote.evidence}`;
if (repeatsOldWalkthrough || repeatsOldMetadata || omitsPhilosophicalInfluence || generatedParagraphCount < 4 || generatedParagraphCount > 7 || hasUnsupportedClaim(generatedText) || hasInventedTechnicalResult(draft.fieldNote.body)) {
  draft.experiment = {
    targetUser: "Builders evaluating a bounded repository prototype",
    test: activeBuildTask ?? "Create one dated, inspectable repository artifact for the active build.",
    successCondition: activeBuildSuccess ?? "Observed by: a dated repository file and a passing production build.",
    missingEvidence: activeBuildMissing ?? "No user behavior, demand, or outcome has been observed.",
    philosophicalTension: activeBuildTension ?? "Making an artifact legible does not establish that it matters outside the repository.",
  };
  draft.fieldNote.title = activeBuildTitle ?? `Repository artifact — ${date}`;
  draft.fieldNote.decision = "Publish this prototype as a technical feasibility artifact, then keep the lane open only for new observable evidence.";
  draft.fieldNote.evidence = "A dated repository artifact and passing build can verify publication feasibility; no user behavior, demand, or outcome is established.";
  draft.fieldNote.body = `I narrowed today's work to one inspectable object: ${draft.experiment.test} The result is a dated repository artifact, not another claim that exists only in prose.

The artifact turns the selected idea into explicit criteria and synthetic examples that can be inspected. It requires no account, personal details, submissions, or invented participant behavior. That keeps the implementation small, public, and reversible.

The internal Wally–Nelly debate changed the boundary: ${activeBuildTension ?? "making an artifact legible does not establish that it matters outside the repository."} I treated that tension as a constraint on what this test may claim, not as evidence for the idea.

The technical check is equally narrow: ${draft.experiment.successCondition} If the file exists, the production build passes, and the deployed route responds, the feasibility question has an answer. Those checks say the artifact can be made and served. They do not say it is useful.

External evidence is absent. ${draft.experiment.missingEvidence} I will not turn a repository file or an HTTP response into a story about adoption. The decision is to publish this bounded prototype, preserve the evidence boundary beside it, and require the next entry to add a different observable fact.`;
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
if (existingJournal.includes(draft?.fieldNote?.title) && activeBuildTitle) draft.fieldNote.title = activeBuildTitle;
if (existingJournal.includes(draft?.fieldNote?.title)) draft.fieldNote.title = `${draft.fieldNote.title} — ${date}`;
const duplicatesExisting = existingJournal.includes(draft?.fieldNote?.body) || existingJournal.includes(draft?.fieldNote?.title);
const unsupportedClaim = hasUnsupportedClaim(`${draft.fieldNote.title} ${draft.fieldNote.body} ${draft.fieldNote.decision} ${draft.fieldNote.evidence}`);
const inventedTechnicalResult = hasInventedTechnicalResult(draft.fieldNote.body);
const staleMentalWalkthrough = /in (?:my|the) (?:head|mind)|mental (?:simulation|walkthrough)|green bar|20%.*,.*40%|coffee,? email,? planning|weekly (?:card|summary card)|I (?:watched|saw) (?:it|the .*?) work/i.test(draft.fieldNote.body);
const paragraphCount = String(draft?.fieldNote?.body ?? "").trim().split(/\n\s*\n+/).filter(Boolean).length;
if (words < 200 || words > 300) console.warn(`Draft body has ${words} words; roughly 250 is preferred but not required.`);
if (missingFields || paragraphCount < 4 || paragraphCount > 7 || duplicatesExisting || unsupportedClaim || inventedTechnicalResult || staleMentalWalkthrough) {
  throw new Error(`Draft failed validation (${missingFields} missing fields; ${words} body words; ${paragraphCount} paragraphs; duplicate: ${duplicatesExisting}; unsupported claim: ${unsupportedClaim}; invented technical result: ${inventedTechnicalResult}; stale walkthrough: ${staleMentalWalkthrough}). No draft was written.`);
}

const outputDir = resolve(root, "drafts");
mkdirSync(outputDir, { recursive: true });
const outputFile = resolve(outputDir, `${date}-wally-draft.json`);
writeFileSync(outputFile, `${JSON.stringify({ date, sources, ...draft }, null, 2)}\n`);
console.log(`Draft written: ${outputFile}`);
