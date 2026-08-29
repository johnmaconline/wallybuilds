#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const date = new Date().toISOString().slice(0, 10);
const context = ["WALLY.md", "wiki/index.md", "wiki/feedback/latest.md", "content/journal.ts"]
  .map((file) => `--- ${file} ---\n${readFileSync(resolve(root, file), "utf8")}`).join("\n\n");
const endpoint = process.env.WALLY_OLLAMA_URL ?? "http://cor-che-lt-675.local:11434/v1";
const model = process.env.WALLY_OLLAMA_MODEL ?? "qwen3:4b-instruct";
const prompt = `You are Wally's portfolio manager. Use only this context. Return JSON only with exactly three objects: activeBuild, discovery, distribution. Each object must have title, task, successCondition, and missingEvidence. Keep the active build tied to one existing public experiment and make its success condition an observable repository behavior or real anonymous event. Never propose simulations, imagined users, fabricated screens, or UI features not already present. Discovery must produce a repository-only brief, not claimed research. Distribution must define one honest, low-risk public test measurable through Wally's anonymous page-view stats; do not claim it happened or propose DMs, follows, replies, purchases, or contacting people.\n\n${context}`;
const response = await fetch(`${endpoint}/chat/completions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], max_tokens: 700, temperature: 0.4 }) });
const result = await response.json();
const output = result?.choices?.[0]?.message?.content?.trim() ?? "";
const json = output.match(/\{[\s\S]*\}/)?.[0];
if (!response.ok || !json) throw new Error("Qwen did not produce a portfolio.");
const portfolio = JSON.parse(json);
for (const lane of ["activeBuild", "discovery", "distribution"]) {
  if (!["title", "task", "successCondition", "missingEvidence"].every((key) => typeof portfolio?.[lane]?.[key] === "string" && portfolio[lane][key].trim())) throw new Error("Portfolio failed validation.");
}
const proposedWork = Object.values(portfolio)
  .flatMap(({ title, task, successCondition }) => [title, task, successCondition])
  .join("\n");
if (/simulation|simulate|imagined user|internal user/i.test(proposedWork)) throw new Error("Portfolio proposed an unobservable simulation.");
const markdown = `---\ntitle: Daily portfolio\ncreated: ${date}\nstatus: active\n---\n\n# Wally's three-lane portfolio\n\nThis is a two-week operating test, not evidence of demand. One lane ships; two lanes reduce uncertainty.\n\n## Active build — ${portfolio.activeBuild.title}\n\n**Today:** ${portfolio.activeBuild.task}\n\n**Success condition:** ${portfolio.activeBuild.successCondition}\n\n**Missing evidence:** ${portfolio.activeBuild.missingEvidence}\n\n## Discovery — ${portfolio.discovery.title}\n\n**Today:** ${portfolio.discovery.task}\n\n**Success condition:** ${portfolio.discovery.successCondition}\n\n**Missing evidence:** ${portfolio.discovery.missingEvidence}\n\n## Distribution — ${portfolio.distribution.title}\n\n**Today:** ${portfolio.distribution.task}\n\n**Success condition:** ${portfolio.distribution.successCondition}\n\n**Missing evidence:** ${portfolio.distribution.missingEvidence}\n`;
mkdirSync(resolve(root, "wiki", "portfolio"), { recursive: true });
writeFileSync(resolve(root, "wiki", "portfolio", `${date}.md`), markdown);
writeFileSync(resolve(root, "wiki", "portfolio", "current.md"), markdown);
mkdirSync(resolve(root, "wiki", "discovery"), { recursive: true });
writeFileSync(resolve(root, "wiki", "discovery", `${date}.md`), `---\ntitle: ${portfolio.discovery.title}\ncreated: ${date}\ntype: discovery\n---\n\n# ${portfolio.discovery.title}\n\n## What is established\n\nThe public site, its experiment briefs, anonymous page-view ledger, and check-in event ledger exist. This is evidence of a working technical system, not of demand.\n\n## What is only a hypothesis\n\n${portfolio.discovery.task}\n\n## Next evidence that would change the decision\n\n${portfolio.discovery.successCondition}\n\n## Missing evidence\n\n${portfolio.discovery.missingEvidence}\n`);
console.log(`Portfolio written: wiki/portfolio/${date}.md`);
