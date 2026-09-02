#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { verifyWallyModel, wallyOllamaModel, wallyOllamaUrl } from "./wally-model.mjs";

const forbiddenClaim = /market validated|proven demand|customers? (?:said|want)|users? (?:said|want)|revenue (?:grew|increased)|research (?:proves|shows)/i;
const staleOrForbiddenWork = /morning|check[ -]?in|checklist|task tracker|summary card|progress bar|mental (?:simulation|walkthrough)|failure message|recovery step|event instrumentation|engagement signal|user identity|personal data|interview|outreach|contact|direct message|purchase|spend|create an account|hardware|firmware|production access/i;
const evidenceReference = /^(?:wally:(?:journal|experiment-index|feedback)|operator-wiki:(?:john-macdonald|engineering-philosophy|ai-practice|writing-craft))$/;
const safeCandidateSeeds = [
  { title: "Requirement Ambiguity Ledger", problem: "Plain-language requests lose uncertainty when converted into implementation rules.", whyItMayMatter: "A precise-looking rule can hide the choice that produced it.", todayTest: "Create a static card mapping three synthetic requests to constraints and unresolved ambiguity.", successCondition: "Observed by: a new dated static artifact and a passing site build.", missingEvidence: "No external use or decision improvement has been observed.", evidenceRefs: ["operator-wiki:engineering-philosophy"] },
  { title: "Documentation Truth Boundary", problem: "Documentation can mix intended behavior, repository-observable behavior, and assumptions.", whyItMayMatter: "Readers may treat an intention as an implemented fact.", todayTest: "Create a static comparison separating claimed, observable, and unverified behavior in synthetic examples.", successCondition: "Observed by: a new dated static artifact and a passing site build.", missingEvidence: "No evidence shows whether the comparison improves real maintenance work.", evidenceRefs: ["operator-wiki:writing-craft"] },
  { title: "Automation Authority Map", problem: "An automated workflow can obscure which agent advises, decides, acts, or must stop.", whyItMayMatter: "Unclear authority makes failures and unsafe scope expansion harder to diagnose.", todayTest: "Create a static authority map for a synthetic multi-agent workflow with explicit stop conditions.", successCondition: "Observed by: a new dated static artifact and a passing site build.", missingEvidence: "No outside team has used or evaluated the map.", evidenceRefs: ["operator-wiki:ai-practice"] },
];

const normalizeHermesPacket = (value) => {
  if (!value || typeof value !== "object") return value;
  const inferences = Array.isArray(value.inferences)
    ? value.inferences.filter((item) => typeof item?.claim === "string" && typeof item?.basis === "string" && !staleOrForbiddenWork.test(`${item.claim} ${item.basis}`))
    : [];
  const modelCandidates = Array.isArray(value.candidateProblems)
    ? value.candidateProblems.filter((item) => item &&
      ["title", "problem", "whyItMayMatter", "todayTest", "successCondition", "missingEvidence"].every((key) => typeof item[key] === "string" && item[key].trim()) &&
      !staleOrForbiddenWork.test(JSON.stringify(item)) && /\b(?:create|generate|add)\b/i.test(item.todayTest))
    : [];
  const titles = new Set(modelCandidates.map((item) => item.title));
  const candidates = [...modelCandidates];
  for (const seed of safeCandidateSeeds) {
    if (candidates.length === 3) break;
    if (!titles.has(seed.title)) candidates.push(seed);
  }
  return {
    ...value,
    establishedFacts: [{ claim: "Wally has a public journal and dated repository experiments.", evidenceRef: "wally:journal" }],
    inferences: inferences.length ? inferences : [{ claim: "Clearer boundaries between claims and checks may make experiments easier to inspect.", basis: "operator-wiki:engineering-philosophy" }],
    candidateProblems: candidates.slice(0, 3).map((item) => ({
      ...item,
      successCondition: "Observed by: a new dated static artifact and a passing site build.",
      evidenceRefs: Array.isArray(item?.evidenceRefs) && item.evidenceRefs.some((reference) => evidenceReference.test(reference))
        ? item.evidenceRefs.filter((reference) => evidenceReference.test(reference))
        : ["wally:journal"],
    })),
    modelCandidateCount: modelCandidates.length,
    publicSources: [],
  };
};

export function isValidHermesPacket(value) {
  if (!value || typeof value.summary !== "string" || !value.summary.trim()) return false;
  if (!Array.isArray(value.establishedFacts) || !Array.isArray(value.inferences) || !Array.isArray(value.candidateProblems)) return false;
  if (value.establishedFacts.length < 1 || value.candidateProblems.length !== 3) return false;
  if (forbiddenClaim.test(JSON.stringify(value)) || staleOrForbiddenWork.test(JSON.stringify(value.candidateProblems))) return false;
  if (new Set(value.candidateProblems.map((item) => item?.title)).size !== 3) return false;
  if (!value.establishedFacts.every((item) => typeof item?.claim === "string" && evidenceReference.test(item?.evidenceRef))) return false;
  if (!value.inferences.every((item) => typeof item?.claim === "string" && typeof item?.basis === "string")) return false;
  return value.candidateProblems.every((item) =>
    ["title", "problem", "whyItMayMatter", "todayTest", "successCondition", "missingEvidence"].every(
      (key) => typeof item?.[key] === "string" && item[key].trim(),
    ) && /\b(?:create|generate|add)\b/i.test(item.todayTest) && /^Observed by:/i.test(item.successCondition) &&
    Array.isArray(item.evidenceRefs) && item.evidenceRefs.length > 0 && item.evidenceRefs.every((reference) => evidenceReference.test(reference)));
}

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
};

const readLimited = (file, limit) => existsSync(file) ? readFileSync(file, "utf8").slice(0, limit) : "Unavailable.";
const clean = (value) => String(value).replace(/\s+/g, " ").trim();
const list = (items, render) => items.length ? items.map(render).join("\n") : "- None.";

export async function runHermesResearch({ root, date, wikiRoot }) {
  const projectContext = [
    ["wally:journal", readLimited(resolve(root, "content/journal.ts"), 7_000)],
    ["wally:experiment-index", readLimited(resolve(root, "wiki/index.md"), 8_000)],
    ["wally:feedback", readLimited(resolve(root, "wiki/feedback/latest.md"), 3_000)],
  ];
  const operatorContext = [
    ["operator-wiki:john-macdonald", "entities/john-macdonald.md"],
    ["operator-wiki:engineering-philosophy", "concepts/how-i-work-engineering-philosophy.md"],
    ["operator-wiki:ai-practice", "concepts/ai-stance-and-practice.md"],
    ["operator-wiki:writing-craft", "concepts/writing-and-craft-philosophy.md"],
  ].map(([label, file]) => [label, readLimited(resolve(wikiRoot, file), 5_000)]);
  const context = [...projectContext, ...operatorContext].map(([label, body]) => `--- ${label} ---\n${body}`).join("\n\n");
  const prompt = `You are Hermes, Wally's research agent. Create a neutral evidence packet before Wally and Nelly form opinions. Compare accumulated public work with the operator's private knowledge wiki to find three distinct, small software problems worth discussing today.

The operator wiki is private thinking context. Do not quote it, reproduce biography, name its projects or employers, expose local paths, or treat the operator's experience as Wally's experience. Distill only general problem-finding lenses. Use only the supplied material. Do not claim fresh web research. Lack of outside evidence is normal. Do not revisit morning routines, check-ins, checklists, task trackers, summary cards, progress bars, mental walkthroughs, failure messages, recovery steps, or event instrumentation. Do not propose identity-linked data. Produce one candidate about requirements ambiguity, one about documentation drift, and one about safe AI-assisted automation. Each test must create a new static repository artifact, and each successCondition must begin "Observed by:".

Return JSON only with: summary; establishedFacts (array of {claim,evidenceRef}, restricted to observable Wally repository facts); inferences (array of {claim,basis}, clearly uncertain); candidateProblems (exactly three objects with title, problem, whyItMayMatter, todayTest, successCondition, missingEvidence, evidenceRefs); publicSources (array, normally empty, of {url,title,interpretation}). Tests must be repository-only, bounded, and executable today. Do not propose outreach, interviews, messages, accounts, spending, personal-data collection, deployment, hardware, firmware, or production access. Do not claim users, customers, traffic, revenue, demand, or market validation. Evidence references must use the labels supplied below.

${context}`;

  let packet;
  let status = "available";
  let correction = "";
  for (let attempt = 1; attempt <= 2 && !isValidHermesPacket(packet); attempt += 1) {
    try {
      const response = await fetch(`${wallyOllamaUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: wallyOllamaModel,
          messages: [{ role: "user", content: `${prompt}\n${correction}` }],
          max_tokens: 1_600,
          temperature: 0.35,
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(120_000),
      });
      const result = await response.json();
      const output = result?.choices?.[0]?.message?.content ?? "";
      const json = extractJsonObject(output);
      if (response.ok && json) packet = normalizeHermesPacket(JSON.parse(json));
      if (!isValidHermesPacket(packet)) {
        console.warn(`Hermes research attempt ${attempt} rejected: response did not satisfy the evidence-packet schema.`);
        if (process.env.HERMES_RESEARCH_DEBUG === "1") console.warn(JSON.stringify(packet).slice(0, 4_000));
      }
    } catch (error) {
      console.warn(`Hermes research attempt ${attempt} failed: ${error?.name ?? "unknown error"}.`);
    }
    correction = "Previous output was rejected. Return exactly three distinct candidateProblems and include every named field. Give every fact and candidate at least one exact evidenceRef label from the supplied context. Every test must create a new artifact and every successCondition must begin 'Observed by:'. Avoid morning/check-in/task-tracker ideas and identity-linked data. Keep publicSources empty. Do not claim users, demand, validation, or fresh research.";
  }

  if (isValidHermesPacket(packet) && packet.modelCandidateCount === 0) status = "fallback";
  if (!isValidHermesPacket(packet)) {
    status = "fallback";
    packet = {
      summary: "Hermes did not return a usable packet. These repository-grounded candidates keep the discussion moving without pretending outside research occurred.",
      establishedFacts: [{ claim: "Wally can create dated static artifacts and verify the site build.", evidenceRef: "wally:experiment-index" }],
      inferences: [{ claim: "Clearer boundaries between claims and checks may make experiments easier to inspect.", basis: "operator-wiki:engineering-philosophy" }],
      candidateProblems: safeCandidateSeeds,
      publicSources: [],
    };
  }

  const allowedRefs = new Set([...projectContext, ...operatorContext].map(([label]) => label));
  packet.establishedFacts = packet.establishedFacts.filter((item) => allowedRefs.has(item.evidenceRef));
  packet.candidateProblems = packet.candidateProblems.map((item) => ({
    ...item,
    evidenceRefs: item.evidenceRefs.filter((reference) => allowedRefs.has(reference)),
  }));
  // This bounded stage does not browse. URLs emitted by a model are discarded rather than mistaken for verified research.
  packet.publicSources = [];

  const markdown = `---\ntitle: Hermes daily research packet\ncreated: ${date}\ntype: internal-research\nstatus: ${status}\n---\n\n# Hermes research packet — ${date}\n\nThis packet is neutral input for Wally and Nelly. Operator-wiki material is private thinking context, not Wally's biography or external evidence. No fresh public-web research was performed.\n\n## Summary\n\n${clean(packet.summary)}\n\n## Established repository facts\n\n${list(packet.establishedFacts, (item) => `- ${clean(item.claim)} _Evidence: ${clean(item.evidenceRef)}_`)}\n\n## Inferences to challenge\n\n${list(packet.inferences, (item) => `- ${clean(item.claim)} _Basis: ${clean(item.basis)}_`)}\n\n## Candidate problems\n\n${packet.candidateProblems.map((item, index) => `### ${index + 1}. ${clean(item.title)}\n\n- **Problem:** ${clean(item.problem)}\n- **Why it may matter:** ${clean(item.whyItMayMatter)}\n- **Today's bounded test:** ${clean(item.todayTest)}\n- **Success condition:** ${clean(item.successCondition)}\n- **Missing evidence:** ${clean(item.missingEvidence)}\n- **Evidence references:** ${item.evidenceRefs.map(clean).join(", ") || "none"}`).join("\n\n")}\n\n## Verified public sources\n\n- None retrieved in this bounded run.\n`;
  const researchDir = resolve(root, "wiki/research");
  mkdirSync(researchDir, { recursive: true });
  writeFileSync(resolve(researchDir, `${date}.md`), markdown);
  writeFileSync(resolve(researchDir, "current.md"), markdown);
  console.log(`Hermes research packet written: wiki/research/${date}.md (${status}).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = resolve(import.meta.dirname, "..");
  const date = process.env.WALLY_RUN_DATE ?? new Date().toISOString().slice(0, 10);
  const wikiRoot = process.env.HERMES_WIKI_PATH ?? "/Users/johnmacdonald/wiki";
  await verifyWallyModel();
  await runHermesResearch({ root, date, wikiRoot });
}
