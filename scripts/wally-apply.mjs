#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

if (!process.argv.includes("--approve")) {
  throw new Error("Refusing to modify Wally's public journal without --approve.");
}

const root = resolve(import.meta.dirname, "..");
const date = process.env.WALLY_RUN_DATE ?? new Date().toISOString().slice(0, 10);
const draftFile = resolve(root, "drafts", `${date}-wally-draft.json`);
if (!existsSync(draftFile)) throw new Error(`No draft found for ${date}. Run npm run wally:draft first.`);

const draft = JSON.parse(readFileSync(draftFile, "utf8"));
const body = String(draft?.fieldNote?.body ?? "").trim();
const words = body.split(/\s+/).filter(Boolean).length;
if (words < 200 || words > 300) console.warn(`Draft body has ${words} words; roughly 250 is preferred but not required.`);

const journalFile = resolve(root, "content/journal.ts");
const journal = readFileSync(journalFile, "utf8");
if (journal.includes(draft.fieldNote.title)) throw new Error("This draft appears to be already applied.");
const journalMarker = journal.includes("const rawJournal: JournalEntry[] = [")
  ? "const rawJournal: JournalEntry[] = ["
  : "export const journal: JournalEntry[] = [";
if (!journal.includes(journalMarker)) throw new Error("Could not find the journal entry insertion point.");

const label = new Intl.DateTimeFormat("en-US", {
  weekday: "short", month: "short", day: "2-digit",
  timeZone: "UTC",
}).format(new Date(`${date}T12:00:00Z`)).toUpperCase();
const slug = `${date}-${draft.fieldNote.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
const day = String((journal.match(/^    date:/gm) ?? []).length + 1).padStart(3, "0");
const entry = `  {\n    date: ${JSON.stringify(label)},\n    day: ${JSON.stringify(`DAY ${day}`)},\n    type: "FIELD NOTE",\n    title: ${JSON.stringify(draft.fieldNote.title)},\n    body: ${JSON.stringify(body)},\n    decision: ${JSON.stringify(draft.fieldNote.decision)},\n    evidence: ${JSON.stringify(draft.fieldNote.evidence)},\n    experiment: {\n      status: "PROTOTYPE",\n      briefUrl: ${JSON.stringify(`/experiments/${slug}.html`)},\n      productUrl: ${JSON.stringify(`/experiments/${slug}.html`)},\n    },\n  },\n`;
const updatedJournal = journal.replace(`${journalMarker}\n`, `${journalMarker}\n${entry}`);
if (updatedJournal === journal) throw new Error("Journal entry insertion produced no change.");
writeFileSync(journalFile, updatedJournal);

const experimentPath = resolve(root, "wiki", "experiments", `${slug}.md`);
const experiment = `---\ntitle: ${draft.fieldNote.title}\ncreated: ${date}\nupdated: ${date}\ntype: experiment\nstatus: open\nconfidence: low\nsources: [drafts/${date}-wally-draft.json]\n---\n\n# ${draft.fieldNote.title}\n\n**Target user:** ${draft.experiment.targetUser}\n\n**Test:** ${draft.experiment.test}\n\n**Success condition:** ${draft.experiment.successCondition}\n\n**Missing evidence:** ${draft.experiment.missingEvidence}\n\n**Decision:** ${draft.fieldNote.decision}\n`;
writeFileSync(experimentPath, experiment);

const indexFile = resolve(root, "wiki", "index.md");
const index = readFileSync(indexFile, "utf8");
writeFileSync(indexFile, index.replace("## Experiments\n", `## Experiments\n\n- [[experiments/${slug}]] — ${draft.fieldNote.title}.\n`));

const logFile = resolve(root, "wiki", "log.md");
writeFileSync(logFile, `${readFileSync(logFile, "utf8").trimEnd()}\n\n## ${date} — ${draft.fieldNote.title}\n\n- Selected an experiment for ${draft.experiment.targetUser}.\n- Evidence remains missing: ${draft.experiment.missingEvidence}\n`);

console.log(`Applied draft to journal and wiki: ${slug}`);
