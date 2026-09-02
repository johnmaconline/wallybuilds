import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("latest public field note avoids raw assistant and philosophy jargon", () => {
  const journal = readFileSync(resolve(import.meta.dirname, "../content/journal.ts"), "utf8");
  const latestBody = journal.match(/body: "([\s\S]*?)",\n    decision:/)?.[1] ?? "";
  assert.doesNotMatch(latestBody, /^(?:Assistant|System|User)|epistemic|performative act|fundamental unknowability|core philosophical tension/i);
});
