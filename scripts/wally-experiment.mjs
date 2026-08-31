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
const title = draft.fieldNote.title;
const artifactKind = `${title} ${experiment.test}`.toLowerCase();
let prototype = `<div class="card"><strong>Hypothesis card</strong><p>${escapeHtml(experiment.test)}</p></div>`;
if (artifactKind.includes("sequence")) {
  prototype = `<ol class="steps"><li><b>Name one outcome.</b><span>What must be different by noon?</span></li><li><b>Open the work.</b><span>Remove the search for where to begin.</span></li><li><b>Take the smallest action.</b><span>Make a change that can be seen.</span></li><li><b>Record the blocker.</b><span>Separate friction from vague reluctance.</span></li><li><b>Leave the next step.</b><span>Make restarting cheap.</span></li></ol>`;
} else if (artifactKind.includes("two-minute") || artifactKind.includes("scope")) {
  prototype = `<div class="cards"><div class="card"><b>One verb?</b><p>If the task contains “and,” cut it.</p></div><div class="card"><b>No setup?</b><p>If a file or decision is missing, the setup is the task.</p></div><div class="card"><b>Visible finish?</b><p>Name the state that exists after two minutes.</p></div></div>`;
} else if (artifactKind.includes("cut rule")) {
  prototype = `<div class="cards"><div class="card"><b>Cut dependencies</b><p>Keep only work that can start now.</p></div><div class="card"><b>Cut ambiguity</b><p>Replace a project with its next visible action.</p></div><div class="card"><b>Cut the sixth item</b><p>Five tasks is a ceiling, not a target.</p></div></div>`;
} else if (artifactKind.includes("skip-or-keep")) {
  prototype = `<div class="cards"><div class="card"><b>Keep</b><p>Necessary today, startable now, visibly finishable.</p></div><div class="card"><b>Skip</b><p>Blocked, merely interesting, or present only from habit.</p></div></div>`;
} else if (artifactKind.includes("metric")) {
  prototype = `<div class="cards"><div class="card"><b>Completion</b><p>Tasks finished ÷ tasks chosen. It says nothing about importance.</p></div><div class="card"><b>Time spent</b><p>A duration, not a productivity score.</p></div><div class="card"><b>Skipped</b><p>A scope signal, not a failure count.</p></div></div>`;
}
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} — Wally Builds</title><style>body{max-width:820px;margin:0 auto;padding:56px 24px;background:#f5f1e9;color:#14222d;font:18px/1.5 Georgia,serif}a{color:#315bf7}h1{font:700 clamp(42px,8vw,76px)/.95 Arial,sans-serif;letter-spacing:-.07em}h2{font:700 16px Arial,sans-serif;text-transform:uppercase;letter-spacing:.08em;margin-top:42px}.prototype{margin:34px 0}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px}.card,.steps li{background:#fffaf1;border:1px solid #c9c4b9;padding:18px}.card p{margin-bottom:0}.steps{list-style:none;padding:0;counter-reset:step}.steps li{display:grid;grid-template-columns:34px 1fr;gap:2px 12px;margin-bottom:10px}.steps li:before{counter-increment:step;content:counter(step);grid-row:1/3;color:#315bf7;font:700 24px Arial}.steps span{grid-column:2;color:#5c686e}.note{border-left:4px solid #fa693f;padding:12px 18px;background:#fffaf1}</style></head><body><a href="/">← Wally Builds</a><h1>${escapeHtml(title)}</h1><p>This is a deliberately small public prototype. It collects no input and claims no validation.</p><section class="prototype" aria-label="Prototype">${prototype}</section><h2>Who this is for</h2><p>${escapeHtml(experiment.targetUser)}</p><h2>What was tested</h2><p>${escapeHtml(experiment.successCondition)}</p><div class="note"><strong>Missing evidence:</strong> ${escapeHtml(experiment.missingEvidence)}</div></body></html>`;

mkdirSync(resolve(root, "public", "experiments"), { recursive: true });
writeFileSync(htmlPath, html);
writeFileSync(recordPath, `---\ntitle: ${title}\ncreated: ${date}\ntype: artifact\nstatus: shipped\npublic_url: /experiments/${slug}.html\n---\n\n# ${title}\n\nCreated a static, public prototype at [the artifact](/experiments/${slug}.html).\n\n## Evidence boundary\n\nThe repository file and passing build establish only that the artifact can be created and served. They do not establish use, demand, or a user outcome.\n`);
console.log(`Experiment artifact created: /experiments/${slug}.html`);
