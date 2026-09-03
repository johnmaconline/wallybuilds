import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
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

test("daily dialogue carries bounded recorded agent experience", () => {
  const runner = readFileSync(resolve(import.meta.dirname, "../scripts/wally-nelly.mjs"), "utf8");
  assert.match(runner, /readdirSync\(conversationDir\).*\.sort\(\)\n  : \[\];/);
  assert.match(runner, /COMPLETE EPISODIC TIMELINE/);
  assert.match(runner, /priorConversationFiles\.map\(episode\)/);
  assert.match(runner, /recentDetailedHistory = priorConversationFiles\.slice\(-2\)/);
  assert.match(runner, /shared_agent_history: evidence\.sharedAgentHistory/g);
  assert.match(runner, /## Shared experience consulted/);
  assert.match(runner, /Never invent a memory, relationship, body, childhood/);
});
