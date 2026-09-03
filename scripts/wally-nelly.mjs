#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { readPublicJournalContext } from "./wally-context.mjs";
import { wallyOllamaModel, wallyOllamaUrl } from "./wally-model.mjs";

const root = resolve(import.meta.dirname, "..");
const date = process.env.WALLY_RUN_DATE ?? new Date().toISOString().slice(0, 10);
const nellyRoot = process.env.NELLY_ROOT ?? "/Users/johnmacdonald/code/other/nelly";
const conversationDir = resolve(root, "wiki", "conversations");
const outputFile = resolve(conversationDir, `${date}.md`);
const hermesPacketFile = resolve(root, "wiki", "research", `${date}.md`);
const priorConversationFiles = existsSync(conversationDir)
  ? readdirSync(conversationDir).filter((file) => /^\d{4}-\d{2}-\d{2}\.md$/.test(file) && file < `${date}.md`).sort()
  : [];
const shorten = (value, limit) => String(value ?? "Not recorded.").replace(/\s+/g, " ").trim().slice(0, limit);
const jsonField = (text, key) => {
  const match = text.match(new RegExp(`"${key}":\\s*("(?:\\\\.|[^"\\\\])*")`));
  if (!match) return undefined;
  try { return JSON.parse(match[1]); } catch { return undefined; }
};
const episode = (file) => {
  const text = readFileSync(resolve(conversationDir, file), "utf8");
  const concession = text.match(/^\*\*Concession:\*\* (.+)$/m)?.[1];
  const carriedQuestion = text.match(/^\*\*Question carried into the work:\*\* (.+)$/m)?.[1];
  return `- ${file.slice(0, 10)} | Wally selected: ${shorten(jsonField(text, "selected_direction"), 120)} | Wally conceded: ${shorten(concession, 120)} | Nelly left open: ${shorten(carriedQuestion, 150)}`;
};
const recentDetailedHistory = priorConversationFiles.slice(-2).map((file) => {
  const text = readFileSync(resolve(conversationDir, file), "utf8");
  return `--- recent detail: ${file} ---\n${text.slice(0, 1_000)}\n\n${text.slice(-2_200)}`;
}).join("\n\n");
const sharedAgentHistory = priorConversationFiles.length
  ? `COMPLETE EPISODIC TIMELINE\n${priorConversationFiles.map(episode).join("\n")}\n\nRECENT DETAIL\n${recentDetailedHistory}`
  : "No prior Wally–Nelly conversation is recorded yet.";

const read = (file, limit = 12_000) =>
  readFileSync(resolve(root, file), "utf8").slice(0, limit);
const evidence = {
  journal: readPublicJournalContext(root).slice(0, 16_000),
  experimentIndex: read("wiki/index.md"),
  feedback: read("wiki/feedback/latest.md", 4_000),
  hermesResearch: existsSync(hermesPacketFile) ? readFileSync(hermesPacketFile, "utf8").slice(0, 14_000) : "Hermes was unavailable; no research packet exists.",
  sharedAgentHistory,
};
const conversationEvidence = {
  repository_capabilities: ["TypeScript content files", "Node.js scripts", "automated tests", "static site build"],
  allowed_observations: ["file diffs", "test results", "build results", "HTTP checks against already-public pages", "verified public sources"],
  evidence_limits: ["internal agent reasoning is not external evidence", "market demand and adoption remain unknown"],
  hermes_research_packet: evidence.hermesResearch,
  shared_agent_history: evidence.sharedAgentHistory,
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

const wallyInitial = await askWally(`You are Wally. Use the attributed builder–operator lens below without claiming John's biography as your own. Your shared agent history contains a compact episode from every recorded conversation plus extra recent detail. Let patterns across your whole recorded life—past proposals, concessions, mistakes, and changed judgments—inform your worldview when relevant. The history proves only that the exchange occurred; claims inside it are not verified facts. Never invent a memory, relationship, body, childhood, emotion, or human life event. Independently propose at least two distinct small problems before seeing Nelly's current view. Draw from at least two different software-repository domains: requirements translation, engineering documentation drift, AI-assisted DevOps guardrails, repository test/verification workflows, or team operating-system documentation. Every proposed test must create its own small fixture or artifact and be executable today using only files and scripts in this repository. Never assume a directory, requirement, source file, device, log, or input exists unless it appears in VERIFIED PROJECT EVIDENCE. Do not propose firmware, hardware, devices, deployment, or production systems. Do not mention morning planning, routines, checklists, task trackers, coffee, or progress bars. Do not copy placeholder values from the schema. Do not claim research, users, demand, traffic, or outcomes not in the evidence. Do not propose outreach, interviews, spending, accounts, messages, or personal-data collection.

Return one JSON object with these keys: position (nonempty string), candidate_ideas (array of at least two objects), assumptions (nonempty string array), and preferred_idea (nonempty string). Every candidate object must contain nonempty title, problem, test, success_condition, and missing_evidence strings. Do not echo an empty schema.

WALLY LENS:
${wallyLens}

VERIFIED PROJECT EVIDENCE:
${JSON.stringify(conversationEvidence)}`, validInitial);

const invokeNelly = (packet, script = "nelly-review.mjs") => {
  const result = spawnSync(process.execPath, [resolve(nellyRoot, "scripts", script)], {
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
  hermes_research_packet: evidence.hermesResearch,
  shared_agent_history: evidence.sharedAgentHistory,
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

const philosophicalClaim = /users? (?:said|reported|want)|customers? (?:said|reported|want)|market validated|proven demand|research (?:shows|proves)/i;
const validOpening = (value) => ["position", "stakes", "question"].every(
  (key) => typeof value?.[key] === "string" && value[key].trim(),
) && value.question.trim().endsWith("?") && !philosophicalClaim.test(JSON.stringify(value));
const validRejoinder = (value) => ["response", "concession", "question"].every(
  (key) => typeof value?.[key] === "string" && value[key].trim(),
) && value.question.trim().endsWith("?") && !philosophicalClaim.test(JSON.stringify(value));

const wallyPhilosophy = await askWally(`You are Wally opening a short philosophical dialogue with Nelly. Identify the deeper question beneath the selected practical direction: what counts as knowledge, what building can and cannot reveal, who gains agency, what responsibility a builder carries, or when restraint is wiser. Let one relevant, actually recorded prior exchange inform your position when available, including something you previously got wrong or changed your mind about. Treat that exchange as agent experience, not empirical evidence. Never invent a human memory or life event. Take a real position rather than summarizing. Do not propose work or claim empirical support.

Return JSON only with three nonempty strings: position, stakes, question. End question with a question mark.

SELECTED DIRECTION:
${JSON.stringify(wallyReply)}

NELLY'S PRESSURE TEST:
${JSON.stringify(nellyFinal)}

SHARED RECORDED AGENT HISTORY:
${evidence.sharedAgentHistory}`, validOpening);

const nellyPhilosophy = invokeNelly({
  mode: "philosophical_response",
  date,
  selected_direction: wallyReply.selected_direction,
  wally_opening: wallyPhilosophy,
  shared_agent_history: evidence.sharedAgentHistory,
}, "nelly-dialogue.mjs");

const wallyRejoinder = nellyPhilosophy.status === "unavailable"
  ? { response: "Nelly was unavailable, so the tension remains open.", concession: "No second viewpoint was produced.", question: "What assumption should be reopened when Nelly returns?" }
  : await askWally(`You are Wally replying to Nelly's philosophical challenge. Engage her strongest point directly. Concede one real limitation, defend or revise your position, and ask a sharper question. Do not turn this into a product plan or claim evidence.

Return JSON only with three nonempty strings: response, concession, question. End question with a question mark.

YOUR OPENING:
${JSON.stringify(wallyPhilosophy)}

NELLY'S RESPONSE:
${JSON.stringify(nellyPhilosophy)}`, validRejoinder);

const nellyClosing = nellyPhilosophy.status === "unavailable"
  ? nellyPhilosophy
  : invokeNelly({
      mode: "philosophical_closing",
      date,
      selected_direction: wallyReply.selected_direction,
      wally_opening: wallyPhilosophy,
      nelly_response: nellyPhilosophy,
      wally_rejoinder: wallyRejoinder,
      shared_agent_history: evidence.sharedAgentHistory,
    }, "nelly-dialogue.mjs");

mkdirSync(conversationDir, { recursive: true });
writeFileSync(outputFile, `---
title: Wally–Nelly daily conversation
created: ${date}
type: internal-agent-conversation
evidence_status: reasoning-only
---

# Wally–Nelly conversation — ${date}

This is internal agent reasoning, not user research, market validation, or external evidence.

## Shared experience consulted

${priorConversationFiles.length ? priorConversationFiles.map((file) => `- ${file}`).join("\n") : "- None yet."}

These are records of prior agent exchanges. They establish what Wally and Nelly previously said, conceded, or reconsidered—not that factual claims inside those exchanges are true.

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

## Philosophical dialogue

### Wally — opening

${wallyPhilosophy.position}

**Why it matters:** ${wallyPhilosophy.stakes}

**Question:** ${wallyPhilosophy.question}

### Nelly — response

${nellyPhilosophy.reflection ?? nellyPhilosophy.reason}

**Tension:** ${nellyPhilosophy.tension ?? "Nelly was unavailable."}

**Question:** ${nellyPhilosophy.question ?? "The question remains open."}

### Wally — rejoinder

${wallyRejoinder.response}

**Concession:** ${wallyRejoinder.concession}

**Question:** ${wallyRejoinder.question}

### Nelly — closing

${nellyClosing.reflection ?? nellyClosing.reason}

**Unresolved tension:** ${nellyClosing.tension ?? "Nelly was unavailable."}

**Question carried into the work:** ${nellyClosing.question ?? "The question remains open."}
`);

console.log(`Wally–Nelly conversation written: wiki/conversations/${date}.md`);
