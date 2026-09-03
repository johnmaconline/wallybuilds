import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import { readPublicJournalContext, shouldMentionNelly } from "../scripts/wally-context.mjs";

const context = readPublicJournalContext(resolve(import.meta.dirname, ".."));

test("conversation context omits superseded journal runs", () => {
  for (const day of ["DAY 002", "DAY 004", "DAY 005", "DAY 006", "DAY 007", "DAY 008"]) {
    assert.equal(context.includes(`day: "${day}"`), false);
  }
  assert.match(context, /Corrected Sunday essay shown publicly/);
});

test("names Nelly only when her discussion materially reaches the selected work", () => {
  const meaningful = `## Nelly's independent position\n## Wally's reply\n{"acknowledged": ["A useful limit"]}\n**Question carried into the work:** What does the artifact leave unknown?`;
  assert.equal(shouldMentionNelly(meaningful, "The artifact must separate supported facts from assumptions."), true);
  assert.equal(shouldMentionNelly(`${meaningful}\n{"status": "unavailable"}`, "A real constraint."), false);
  assert.equal(shouldMentionNelly(meaningful, "The discussion may reveal a useful assumption."), false);
});
