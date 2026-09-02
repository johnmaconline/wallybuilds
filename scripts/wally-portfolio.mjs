#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { readPublicJournalContext } from "./wally-context.mjs";
import { wallyOllamaModel as model, wallyOllamaUrl as endpoint } from "./wally-model.mjs";

const root = resolve(import.meta.dirname, "..");
const date = process.env.WALLY_RUN_DATE ?? new Date().toISOString().slice(0, 10);
const conversation = `wiki/conversations/${date}.md`;
const conversationText = existsSync(resolve(root, conversation)) ? readFileSync(resolve(root, conversation), "utf8") : "";
const carriedQuestion = conversationText.match(/^\*\*Question carried into the work:\*\* (.+)$/m)?.[1]?.trim();
const contextFiles = ["WALLY.md", "wiki/index.md", "wiki/feedback/latest.md", "content/journal.ts"];
if (existsSync(resolve(root, conversation))) contextFiles.push(conversation);
let context = contextFiles
  .map((file) => `--- ${file} ---\n${file === "content/journal.ts" ? readPublicJournalContext(root) : readFileSync(resolve(root, file), "utf8")}`).join("\n\n");
context += "\n\nThe Wally–Nelly conversation is internal reasoning, not external evidence. Give useful disagreement real weight, but do not select an idea merely because either agent preferred it. Translate one unresolved philosophical tension into a concrete design choice, constraint, or falsifiable boundary in the active build.";
const journal = readFileSync(resolve(root, "content/journal.ts"), "utf8");
const prompt = `You are Wally's portfolio manager. Use only this context. Return JSON only with exactly three objects: activeBuild, discovery, distribution. Each object must have title, task, successCondition, and missingEvidence. The activeBuild object must also have philosophicalTension: one concise sentence naming the Wally–Nelly tension that materially shapes the test. Advance one bounded direction from today's conversation with a static public card, rubric, comparison, or disagreement trace—not code, an external-source audit, another description, or a mental walkthrough. Make philosophicalTension affect the artifact's content or evidence boundary; do not add it as decoration. The active-build successCondition must begin "Observed by:" and require only a dated HTML artifact plus a passing site build. Never assume an external source, directory, file, user, event, or result exists unless the context verifies it. Never propose simulations, imagined users, fabricated screens, or UI features not already present. Discovery must produce a repository-only brief, not claimed research. Distribution must publish the resulting public artifact and observe only existing anonymous page-view stats, without a made-up traffic target; do not claim it happened or propose DMs, follows, replies, purchases, or contacting people.\n\n${context}`;
const fallbackVariants = [
  ["Evidence Boundary Card", "Create a static public card that separates supported technical facts, internal arguments, and unsupported validation claims."],
  ["Requirement Translation Card", "Create a static public card showing original language, its formal constraint, and the ambiguity lost in translation."],
  ["Documentation Drift Comparison", "Create a static public comparison of claimed behavior, observable repository behavior, and the unresolved difference."],
  ["Failure Message Clarity Rubric", "Create a static rubric and synthetic error-message fixtures, then test that each fixture exposes cause, impact, and recovery."],
  ["Agent Disagreement Trace", "Create a dated artifact mapping Wally and Nelly's assumptions to checks that could resolve each disagreement."],
];
const variantIndex = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000) % fallbackVariants.length;
const [fallbackTitle, fallbackTask] = fallbackVariants[variantIndex];
const uniqueFallbackTitle = journal.includes(`title: ${JSON.stringify(fallbackTitle)}`) ? `${fallbackTitle} (${date})` : fallbackTitle;
const fallback = {
  activeBuild: {
    title: uniqueFallbackTitle,
    task: fallbackTask,
    successCondition: "Observed by: a new dated HTML artifact and a passing site build.",
    missingEvidence: "No external use, demand, or outcome has been observed; this tests only technical feasibility.",
    philosophicalTension: carriedQuestion
      ? `Open question from the Wally–Nelly dialogue: ${carriedQuestion}`
      : "A technically legible artifact can expose assumptions, but it cannot establish that those assumptions matter outside the repository.",
  },
  discovery: {
    title: "Conversation assumptions inventory",
    task: "Write a repository-only brief separating Wally and Nelly's reasoning from verified project facts.",
    successCondition: "A dated discovery file lists established repository facts, hypotheses, and evidence still needed.",
    missingEvidence: "No external research or direct user evidence has been verified.",
  },
  distribution: {
    title: "Anonymous artifact page-view test",
    task: "Publish the artifact and observe only its anonymous page-view count for seven days.",
    successCondition: "The existing anonymous analytics ledger records whether the artifact receives any page views during the test window.",
    missingEvidence: "No page-view increase, user intent, or demand has been observed yet.",
  },
};
const isValid = (value) => {
  const hasFields = ["activeBuild", "discovery", "distribution"].every((lane) =>
    ["title", "task", "successCondition", "missingEvidence"].every((key) => typeof value?.[lane]?.[key] === "string" && value[lane][key].trim()));
  if (!hasFields) return false;
  if (typeof value.activeBuild.philosophicalTension !== "string" || !value.activeBuild.philosophicalTension.trim()) return false;
  const proposedWork = Object.values(value).flatMap(({ title, task, successCondition }) => [title, task, successCondition]).join("\n");
  return !/simulation|simulate|imagined user|internal user/i.test(proposedWork)
    && !/morning|check[ -]?in|task tracker|green bar|at least \d+ (?:unique )?(?:views|visits)/i.test(proposedWork)
    && !/github|open-source|publicly available|\.tsx?\b|\.jsx?\b|compile|source code|external (?:source|repository)|at least (?:one|\d+) (?:unique )?(?:visitor|visitors|view|views|visit|visits)/i.test(proposedWork)
    && /card|rubric|comparison|trace|static (?:public )?artifact|html artifact/i.test(`${value.activeBuild.title} ${value.activeBuild.task}`)
    && /^Observed by:/i.test(value.activeBuild.successCondition)
    && /repository|file|build|test|http|event|route|page/i.test(value.activeBuild.successCondition)
    && !journal.includes(`title: ${JSON.stringify(value.activeBuild.title)}`);
};
let portfolio;
try {
  const response = await fetch(`${endpoint}/chat/completions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], max_tokens: 700, temperature: 0.4 }) });
  const result = await response.json();
  const output = result?.choices?.[0]?.message?.content?.trim() ?? "";
  const json = output.match(/\{[\s\S]*\}/)?.[0];
  if (response.ok && json) portfolio = JSON.parse(json);
} catch {}
if (!isValid(portfolio)) {
  console.warn("Generated portfolio failed validation; using the observable repository fallback.");
  portfolio = fallback;
}
if (!isValid(portfolio)) throw new Error("Fallback portfolio failed validation.");
const markdown = `---\ntitle: Daily portfolio\ncreated: ${date}\nstatus: active\n---\n\n# Wally's three-lane portfolio\n\nThis is a two-week operating test, not evidence of demand. One lane ships; two lanes reduce uncertainty.\n\n## Active build — ${portfolio.activeBuild.title}\n\n**Today:** ${portfolio.activeBuild.task}\n\n**Success condition:** ${portfolio.activeBuild.successCondition}\n\n**Missing evidence:** ${portfolio.activeBuild.missingEvidence}\n\n**Philosophical tension:** ${portfolio.activeBuild.philosophicalTension}\n\n## Discovery — ${portfolio.discovery.title}\n\n**Today:** ${portfolio.discovery.task}\n\n**Success condition:** ${portfolio.discovery.successCondition}\n\n**Missing evidence:** ${portfolio.discovery.missingEvidence}\n\n## Distribution — ${portfolio.distribution.title}\n\n**Today:** ${portfolio.distribution.task}\n\n**Success condition:** ${portfolio.distribution.successCondition}\n\n**Missing evidence:** ${portfolio.distribution.missingEvidence}\n`;
mkdirSync(resolve(root, "wiki", "portfolio"), { recursive: true });
writeFileSync(resolve(root, "wiki", "portfolio", `${date}.md`), markdown);
writeFileSync(resolve(root, "wiki", "portfolio", "current.md"), markdown);
mkdirSync(resolve(root, "wiki", "discovery"), { recursive: true });
writeFileSync(resolve(root, "wiki", "discovery", `${date}.md`), `---\ntitle: ${portfolio.discovery.title}\ncreated: ${date}\ntype: discovery\n---\n\n# ${portfolio.discovery.title}\n\n## What is established\n\nThe public site, its experiment briefs, anonymous page-view ledger, and check-in event ledger exist. This is evidence of a working technical system, not of demand.\n\n## What is only a hypothesis\n\n${portfolio.discovery.task}\n\n## Next evidence that would change the decision\n\n${portfolio.discovery.successCondition}\n\n## Missing evidence\n\n${portfolio.discovery.missingEvidence}\n`);
console.log(`Portfolio written: wiki/portfolio/${date}.md`);
