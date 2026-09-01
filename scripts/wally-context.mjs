import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const supersededDays = new Set(["DAY 002", "DAY 004", "DAY 005", "DAY 006", "DAY 007"]);

export function readPublicJournalContext(root) {
  const journal = readFileSync(resolve(root, "content/journal.ts"), "utf8");
  const blocks = journal.match(/  \{\n    date:[\s\S]*?\n  \},(?=\n  \{|\n\];)/g) ?? [];
  const visible = blocks.filter((block) => {
    const day = block.match(/day: "(DAY \d+)"/)?.[1];
    return day && day !== "DAY 008" && !supersededDays.has(day);
  });
  const sunday = readFileSync(resolve(root, "content/editorial-overrides.ts"), "utf8");
  return [
    "// Effective public journal entries; superseded runs are omitted.",
    ...visible,
    "// Corrected Sunday essay shown publicly:",
    sunday,
  ].join("\n\n");
}
