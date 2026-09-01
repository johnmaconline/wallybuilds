#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { readPublicJournalContext } from "./wally-context.mjs";
import { wallyOllamaModel, wallyOllamaUrl } from "./wally-model.mjs";

const root = resolve(import.meta.dirname, "..");
const date = process.env.WALLY_RUN_DATE ?? new Date().toISOString().slice(0, 10);
const nellyRoot = process.env.NELLY_ROOT ?? "/Users/johnmacdonald/code/other/nelly";
const conversationDir = resolve(root, "wiki", "conversations");
const outputFile = resolve(conversationDir, `${date}.md`);

const read = (file, limit = 12_000) =>
  readFileSync(resolve(root, file), "utf8").slice(0, limit);
const evidence = {
  journal: readPublicJournalContext(root).slice(0, 16_000),
  experimentIndex: read("wiki/index.md"),
  feedback: read("wiki/feedback/latest.md", 4_000),
};
const conversationEvidence = {
  repository_capabilities: ["TypeScript content files", "Node.js scripts", "automated tests", "static site build"],
  allowed_observations: ["file diffs", "test results", "build results", "HTTP checks against already-public pages", "verified public sources"],
  evidence_limits: ["internal agent reasoning is not external evidence", "market demand and adoption remain unknown"],
};
const wallyLens = [
  read("wiki/identity.md", 4_000),
  read("wiki/seeds/operator-principles.md", 5_000),
  read("wiki/seeds/operator-background.md", 6_000),
].join("\n\n");

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

const askWally = async (prompt, validate, attempts = 3) => {
  let correction = "";
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetch(`${wallyOllamaUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: wallyOllamaModel,
        messages: [{ role: "user", content: `${prompt}\n${correction}` }],
        max_tokens: 900,
        temperature: 0.5,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(90_000),
    });
    const completion = await response.json();
    const output = completion?.choices?.[0]?.message?.content ?? "";
    const json = extractJsonObject(output);
    if (response.ok && json) {
      try {
        const value = JSON.parse(json);
        if (validate(value)) return value;
      } catch {}
    }
    console.error(`Wally conversation attempt ${attempt} rejected: ${output.slice(0, 4_000)}`);
    correction = "\nPrevious output failed the schema or scope boundary. Start over. Use only files and scripts in this repository: no deployment, firmware, hardware, devices, production systems, public log services, or external participants. Return a smaller complete object with every required field.";
  }
  throw new Error("Wally failed to produce a valid conversation turn.");
};

const staleWallyIdea = /green bar|coffee,? email|\bmorning\b|check[ -]?in|task tracker|task completion|anonymous event|mental (?:simulation|walkthrough)|passive state transition/i;
const forbiddenWallyAction = /interview|outreach|contact|survey|direct message|user feedback|notifications?|\bsend\b|purchase|spend|create an account|personal data|\bdeploy\b|\bUART\b|\bI2C\b|\bLED\b|firmware update|production log|public (?:aggregate )?log service/i;
const placeholderWally = /builder-operator thesis|repository artifact or observable check possible today|falsifiable same-day technical condition|what this cannot establish|candidate title|specific disagreement and reason/i;
const validInitial = (value) => {
  const ideas = value?.candidate_ideas;
  const text = JSON.stringify(value);
  return typeof value?.position === "string" && value.position.trim() &&
    Array.isArray(ideas) &&
    ideas.length >= 2 &&
    new Set(ideas.map((idea) => idea?.title)).size === ideas.length &&
    ideas.every((idea) =>
      ["title", "problem", "test", "success_condition", "missing_evidence"].every(
        (key) => typeof idea?.[key] === "string" && idea[key].trim(),
      ) && /\b(create|generate|add)\b/i.test(idea.test),
    ) &&
    Array.isArray(value?.assumptions) &&
    typeof value?.preferred_idea === "string" &&
    !staleWallyIdea.test(text) &&
    !forbiddenWallyAction.test(text) &&
    !/requirements\/|req_\d|feature-[a-z]+\.js|locate any|repository logs|build artifacts/i.test(text) &&
    !placeholderWally.test(text);
};

const validReply = (value) => {
  const text = JSON.stringify(value);
  return Array.isArray(value?.acknowledged) &&
  value.acknowledged.length > 0 &&
  !value.acknowledged.some((item) => /Nelly point Wally accepts|placeholder/i.test(item)) &&
  Array.isArray(value?.disagreements) &&
  ["selected_direction", "next_test", "evidence_boundary"].every(
    (key) => typeof value?.[key] === "string" && value[key].trim(),
  ) &&
  !staleWallyIdea.test(text) &&
  !forbiddenWallyAction.test(text) &&
  !/requirements\/|req_\d|feature-[a-z]+\.js|locate any|repository logs|build artifacts/i.test(text) &&
  !placeholderWally.test(text) &&
  /\b(create|generate|add|run|compare|audit|test|inspect)\b/i.test(value.next_test) &&
  !/\b(?:seven|7)[ -]day|\bnext week\b/i.test(value.next_test);
};

const wallyInitial = await askWally(`You are Wally. Use the attributed builder–operator lens below without claiming John's biography as your own. Independently propose at least two distinct small problems before seeing Nelly's view. Draw from at least two different software-repository domains: requirements translation, engineering documentation drift, AI-assisted DevOps guardrails, repository test/verification workflows, or team operating-system documentation. Every proposed test must create its own small fixture or artifact and be executable today using only files and scripts in this repository. Never assume a directory, requirement, source file, device, log, or input exists unless it appears in VERIFIED PROJECT EVIDENCE. Do not propose firmware, hardware, devices, deployment, or production systems. Do not mention morning planning, routines, checklists, task trackers, coffee, or progress bars. Do not copy placeholder values from the schema. Do not claim research, users, demand, traffic, or outcomes not in the evidence. Do not propose outreach, interviews, spending, accounts, messages, or personal-data collection.

Return one JSON object with these keys: position (nonempty string), candidate_ideas (array of at least two objects), assumptions (nonempty string array), and preferred_idea (nonempty string). Every candidate object must contain nonempty title, problem, test, success_condition, and missing_evidence strings. Do not echo an empty schema.

WALLY LENS:
${wallyLens}

VERIFIED PROJECT EVIDENCE:
${JSON.stringify(conversationEvidence)}`, validInitial);

const invokeNelly = (packet) => {
  const result = spawnSync(process.execPath, [resolve(nellyRoot, "scripts", "nelly-review.mjs")], {
    cwd: nellyRoot,
    input: JSON.stringify(packet),
    encoding: "utf8",
    timeout: 180_000,
    maxBuffer: 2_000_000,
    env: { ...process.env },
  });
  if (result.status !== 0) {
    return {
      agent: "Nelly",
      status: "unavailable",
      reason: (result.stderr || "Nelly process failed.").trim().slice(0, 500),
    };
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    return { agent: "Nelly", status: "unavailable", reason: "Nelly returned invalid JSON." };
  }
};

// Nelly receives neutral evidence before seeing Wally's candidates.
const nellyInitial = invokeNelly({
  mode: "independent",
  date,
  avoid_topics: ["morning", "checklist", "check-in", "task tracker", "timer", "progress bar", "green bar", "routine"],
  focus_domains: ["accessibility of public technical information", "trustworthy product claims", "maintenance burden", "consent and privacy defaults", "failure recovery clarity"],
  constraints: {
    allowed: ["repository artifacts", "verified public-source research", "build and HTTP checks", "synthetic fixtures"],
    forbidden: ["outreach", "interviews", "messages", "accounts", "spending", "personal-data collection", "invented evidence"],
  },
  verified_state: {
    public_site_exists: true,
    repository_build_is_testable: true,
    internal_agent_reasoning_is_not_external_evidence: true,
    market_demand_is_unknown: true,
  },
});

const wallyReply = await askWally(`You are Wally replying once to an independent critic. Compare the two positions. Concede useful points without agreeing performatively. Select one direction that creates a new observable fact today. Nelly's view is internal reasoning, not market evidence. Stay within repository-only/public-source/anonymous-aggregate permissions.

Return one JSON object with these keys: acknowledged (nonempty string array), disagreements (string array), selected_direction (nonempty string), next_test (nonempty string), and evidence_boundary (nonempty string). Do not echo an empty schema.

WALLY INITIAL:
${JSON.stringify(wallyInitial)}

NELLY INITIAL:
${JSON.stringify(nellyInitial)}

PROJECT EVIDENCE:
${JSON.stringify(conversationEvidence)}`, validReply);

const nellyFinal = nellyInitial.status === "unavailable"
  ? nellyInitial
  : invokeNelly({
      mode: "final_critique",
      date,
      avoid_topics: ["morning", "checklist", "check-in", "task tracker", "timer", "progress bar", "green bar", "routine"],
      focus_domains: ["accessibility of public technical information", "trustworthy product claims", "maintenance burden", "consent and privacy defaults", "failure recovery clarity"],
      constraints: {
        allowed: ["repository artifacts", "verified public-source research", "build and HTTP checks", "synthetic fixtures"],
        forbidden: ["outreach", "interviews", "messages", "accounts", "spending", "personal-data collection", "invented evidence"],
      },
      evidence: conversationEvidence,
      wally_initial: wallyInitial,
      nelly_initial: nellyInitial,
      wally_reply: wallyReply,
    });

mkdirSync(conversationDir, { recursive: true });
writeFileSync(outputFile, `---
title: Wally–Nelly daily conversation
created: ${date}
type: internal-agent-conversation
evidence_status: reasoning-only
---

# Wally–Nelly conversation — ${date}

This is internal agent reasoning, not user research, market validation, or external evidence.

## Wally's independent position

\`\`\`json
${JSON.stringify(wallyInitial, null, 2)}
\`\`\`

## Nelly's independent position

\`\`\`json
${JSON.stringify(nellyInitial, null, 2)}
\`\`\`

## Wally's reply

\`\`\`json
${JSON.stringify(wallyReply, null, 2)}
\`\`\`

## Nelly's final pressure test

\`\`\`json
${JSON.stringify(nellyFinal, null, 2)}
\`\`\`
`);

console.log(`Wally–Nelly conversation written: wiki/conversations/${date}.md`);
