import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isValidHermesPacket } from "../scripts/wally-hermes.mjs";

const root = resolve(import.meta.dirname, "..");
const candidate = {
  title: "A bounded problem",
  problem: "A claim lacks an inspectable check.",
  whyItMayMatter: "The boundary is unclear.",
  todayTest: "Create a static comparison.",
  successCondition: "Observed by: a dated artifact and passing build.",
  missingEvidence: "No external use has been observed.",
  evidenceRefs: ["wally:journal"],
};

test("Hermes accepts evidence-separated research packets", () => {
  assert.equal(isValidHermesPacket({
    summary: "Three candidates from repository evidence.",
    establishedFacts: [{ claim: "The site builds.", evidenceRef: "wally:experiment-index" }],
    inferences: [{ claim: "The boundary may be unclear.", basis: "operator-wiki:engineering-philosophy" }],
    candidateProblems: [candidate, { ...candidate, title: "Second" }, { ...candidate, title: "Third" }],
    publicSources: [],
  }), true);
});

test("Hermes rejects invented validation", () => {
  assert.equal(isValidHermesPacket({
    summary: "Research proves demand.", establishedFacts: [], inferences: [],
    candidateProblems: [candidate, candidate, candidate], publicSources: [],
  }), false);
});

test("autopilot runs Hermes before the Wally-Nelly conversation", () => {
  const autopilot = readFileSync(resolve(root, "scripts/wally-autopilot.mjs"), "utf8");
  assert.ok(autopilot.indexOf('"wally:research"') < autopilot.indexOf('"wally:conversation"'));
  assert.ok(autopilot.indexOf('"wally:conversation"') < autopilot.indexOf('weekday === "Sunday"'));
  const conversation = readFileSync(resolve(root, "scripts/wally-nelly.mjs"), "utf8");
  assert.match(conversation, /hermes_research_packet: evidence\.hermesResearch/g);
});

test("Sunday synthesis consumes and commits the daily research and conversation", () => {
  const weekly = readFileSync(resolve(root, "scripts/wally-weekly.mjs"), "utf8");
  assert.match(weekly, /wiki\/research\/\$\{runDay\}\.md/);
  assert.match(weekly, /wiki\/conversations\/\$\{runDay\}\.md/);
  assert.match(weekly, /"wiki\/research", "wiki\/conversations"/);
});
