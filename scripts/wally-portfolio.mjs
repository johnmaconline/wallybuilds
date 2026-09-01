#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { wallyOllamaModel as model, wallyOllamaUrl as endpoint } from "./wally-model.mjs";

const root = resolve(import.meta.dirname, "..");
const date = process.env.WALLY_RUN_DATE ?? new Date().toISOString().slice(0, 10);
const context = ["WALLY.md", "wiki/index.md", "wiki/feedback/latest.md", "content/journal.ts"]
  .map((file) => `--- ${file} ---\n${readFileSync(resolve(root, file), "utf8")}`).join("\n\n");
const journal = readFileSync(resolve(root, "content/journal.ts"), "utf8");
const prompt = `You are Wally's portfolio manager. Use only this context. Return JSON only with exactly three objects: activeBuild, discovery, distribution. Each object must have title, task, successCondition, and missingEvidence. Keep the active build tied to one existing public experiment and advance it with a new repository artifact, executable check, or actual anonymous event—not another description or mental walkthrough. The active-build successCondition must begin "Observed by:" and name a repository file, build/test result, HTTP response, or actual anonymous event that can be checked today. Never propose simulations, imagined users, fabricated screens, or UI features not already present. Discovery must produce a repository-only brief, not claimed research. Distribution must define one honest, low-risk public test measurable through Wally's anonymous page-view stats; do not claim it happened or propose DMs, follows, replies, purchases, or contacting people.\n\n${context}`;
const fallbackVariants = [
  ["Morning Task Cut Rule Card", "Create a public, no-input card with three rules for cutting a morning plan down to five two-minute tasks."],
  ["Two-Minute Scope Checklist", "Create a public, no-input checklist for deciding whether a task genuinely fits inside two minutes."],
  ["Morning Sequence Card", "Create a public, no-input artifact that arranges five small morning tasks into a clear start-to-finish sequence."],
  ["Skip-or-Keep Decision Card", "Create a public, no-input decision card for dropping one morning task when the five-task plan becomes too large."],
  ["Weekly Summary Metric Guide", "Create a public, no-input guide explaining the completion, time-spent, and skipped-task metrics already shown by the check-in concept."],
];
const variantIndex = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000) % fallbackVariants.length;
const [fallbackTitle, fallbackTask] = fallbackVariants[variantIndex];
const uniqueFallbackTitle = journal.includes(`title: ${JSON.stringify(fallbackTitle)}`) ? `${fallbackTitle} (${date})` : fallbackTitle;
const fallback = {
  activeBuild: {
    title: uniqueFallbackTitle,
    task: fallbackTask,
    successCondition: "Observed by: a new dated file in public/experiments, a passing site build, and an HTTP 200 response after deployment.",
    missingEvidence: "No user behavior, demand, or outcome has been observed; this tests only whether the artifact can be made and published.",
  },
  discovery: {
    title: "Morning-task assumptions inventory",
    task: "Write a repository-only brief separating existing artifact behavior from unverified assumptions about solo-founder mornings.",
    successCondition: "A dated discovery file lists established repository facts, hypotheses, and evidence still needed.",
    missingEvidence: "No external research or direct user evidence has been verified.",
  },
  distribution: {
    title: "Anonymous cut-list page-view test",
    task: "Publish the artifact and observe only its anonymous page-view count for seven days.",
    successCondition: "The existing anonymous analytics ledger records whether the artifact receives any page views during the test window.",
    missingEvidence: "No page-view increase, user intent, or demand has been observed yet.",
  },
};
const isValid = (value) => {
  const hasFields = ["activeBuild", "discovery", "distribution"].every((lane) =>
    ["title", "task", "successCondition", "missingEvidence"].every((key) => typeof value?.[lane]?.[key] === "string" && value[lane][key].trim()));
  if (!hasFields) return false;
  const proposedWork = Object.values(value).flatMap(({ title, task, successCondition }) => [title, task, successCondition]).join("\n");
  return !/simulation|simulate|imagined user|internal user/i.test(proposedWork)
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
const markdown = `---\ntitle: Daily portfolio\ncreated: ${date}\nstatus: active\n---\n\n# Wally's three-lane portfolio\n\nThis is a two-week operating test, not evidence of demand. One lane ships; two lanes reduce uncertainty.\n\n## Active build — ${portfolio.activeBuild.title}\n\n**Today:** ${portfolio.activeBuild.task}\n\n**Success condition:** ${portfolio.activeBuild.successCondition}\n\n**Missing evidence:** ${portfolio.activeBuild.missingEvidence}\n\n## Discovery — ${portfolio.discovery.title}\n\n**Today:** ${portfolio.discovery.task}\n\n**Success condition:** ${portfolio.discovery.successCondition}\n\n**Missing evidence:** ${portfolio.discovery.missingEvidence}\n\n## Distribution — ${portfolio.distribution.title}\n\n**Today:** ${portfolio.distribution.task}\n\n**Success condition:** ${portfolio.distribution.successCondition}\n\n**Missing evidence:** ${portfolio.distribution.missingEvidence}\n`;
mkdirSync(resolve(root, "wiki", "portfolio"), { recursive: true });
writeFileSync(resolve(root, "wiki", "portfolio", `${date}.md`), markdown);
writeFileSync(resolve(root, "wiki", "portfolio", "current.md"), markdown);
mkdirSync(resolve(root, "wiki", "discovery"), { recursive: true });
writeFileSync(resolve(root, "wiki", "discovery", `${date}.md`), `---\ntitle: ${portfolio.discovery.title}\ncreated: ${date}\ntype: discovery\n---\n\n# ${portfolio.discovery.title}\n\n## What is established\n\nThe public site, its experiment briefs, anonymous page-view ledger, and check-in event ledger exist. This is evidence of a working technical system, not of demand.\n\n## What is only a hypothesis\n\n${portfolio.discovery.task}\n\n## Next evidence that would change the decision\n\n${portfolio.discovery.successCondition}\n\n## Missing evidence\n\n${portfolio.discovery.missingEvidence}\n`);
console.log(`Portfolio written: wiki/portfolio/${date}.md`);
