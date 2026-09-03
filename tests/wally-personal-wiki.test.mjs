import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (file) => readFileSync(resolve(root, file), "utf8");

test("Wally reads and deterministically updates his personal wiki after a successful build", () => {
  const conversation = read("scripts/wally-nelly.mjs");
  const autopilot = read("scripts/wally-autopilot.mjs");
  const weekly = read("scripts/wally-weekly.mjs");
  const memory = read("scripts/wally-memory.mjs");
  assert.match(conversation, /read\("wiki\/self\/worldview\.md"/);
  assert.match(conversation, /read\("wiki\/self\/beliefs\.md"/);
  assert.ok(autopilot.indexOf('"build"') < autopilot.indexOf('"wally:memory"'));
  assert.match(memory, /experience .* is immutable/);
  assert.match(memory, /scripts\/nelly-memory\.mjs/);
  assert.match(weekly, /"wiki\/self"/);
});

test("Wally's backfilled experience is source-linked and evidence bounded", () => {
  const experience = read("wiki/self/experiences/2026-09-02.md");
  assert.match(experience, /wiki\/conversations\/2026-09-02\.md/);
  assert.match(experience, /Selected direction:/);
  assert.match(experience, /does not verify factual claims/);
});
