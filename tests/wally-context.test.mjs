import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import { readPublicJournalContext } from "../scripts/wally-context.mjs";

const context = readPublicJournalContext(resolve(import.meta.dirname, ".."));

test("conversation context omits superseded journal runs", () => {
  for (const day of ["DAY 002", "DAY 004", "DAY 005", "DAY 006", "DAY 007", "DAY 008"]) {
    assert.equal(context.includes(`day: "${day}"`), false);
  }
  assert.match(context, /Corrected Sunday essay shown publicly/);
});
