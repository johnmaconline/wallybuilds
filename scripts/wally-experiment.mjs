#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

if (!process.argv.includes("--approve")) {
  throw new Error("Refusing to create a public experiment artifact without --approve.");
}

const root = resolve(import.meta.dirname, "..");
const date = process.env.WALLY_RUN_DATE ?? new Date().toISOString().slice(0, 10);
const draftFile = resolve(root, "drafts", `${date}-wally-draft.json`);
if (!existsSync(draftFile)) throw new Error(`No draft found for ${date}. Run npm run wally:draft first.`);

const draft = JSON.parse(readFileSync(draftFile, "utf8"));
const experiment = draft?.experiment;
if (![experiment?.targetUser, experiment?.test, experiment?.successCondition, experiment?.missingEvidence].every((value) => typeof value === "string" && value.trim())) {
  throw new Error("Draft has no usable experiment brief.");
}

const slug = `${date}-${draft.fieldNote.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
const htmlPath = resolve(root, "public", "experiments", `${slug}.html`);
const recordPath = resolve(root, "wiki", "experiments", `${slug}-artifact.md`);
if (existsSync(htmlPath) || existsSync(recordPath)) throw new Error("This experiment artifact already exists.");

const escapeHtml = (value) => value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
const title = "Idea validation canvas";
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — Wally Builds</title><style>body{max-width:740px;margin:0 auto;padding:56px 24px;background:#f5f1e9;color:#14222d;font:18px/1.5 Georgia,serif}a{color:#315bf7}h1{font:700 clamp(42px,8vw,76px)/.95 Arial,sans-serif;letter-spacing:-.07em}h2{font:700 16px Arial,sans-serif;text-transform:uppercase;letter-spacing:.08em;margin-top:42px}.note{border-left:4px solid #fa693f;padding:12px 18px;background:#fffaf1}</style></head><body><a href="/">← Wally Builds</a><h1>${title}</h1><p>This is a deliberately small public prototype. It does not collect submissions or claim validation; it makes the hypothesis inspectable.</p><h2>Who this is for</h2><p>${escapeHtml(experiment.targetUser)}</p><h2>The test</h2><p>${escapeHtml(experiment.test)}</p><h2>What would count</h2><p>${escapeHtml(experiment.successCondition)}</p><div class="note"><strong>Current evidence:</strong> ${escapeHtml(experiment.missingEvidence)}</div></body></html>`;

mkdirSync(resolve(root, "public", "experiments"), { recursive: true });
writeFileSync(htmlPath, html);
writeFileSync(recordPath, `---\ntitle: ${title}\ncreated: ${date}\ntype: artifact\nstatus: shipped\npublic_url: /experiments/${slug}.html\n---\n\n# ${title}\n\nCreated a static, public experiment canvas at [the artifact](/experiments/${slug}.html).\n\n## Constraint\n\nThe current success condition requires a user submission, but Wally may not collect personal data or contact people without approval. The artifact is therefore a prototype only; it records no validation result.\n`);
console.log(`Experiment artifact created: /experiments/${slug}.html`);
