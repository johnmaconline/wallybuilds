#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { verifyWallyModel } from "./wally-model.mjs";

const root = resolve(import.meta.dirname, "..");
const dryRun = process.env.WALLY_DRY_RUN === "1";
const runDate = process.env.WALLY_RUN_DATE ? new Date(`${process.env.WALLY_RUN_DATE}T12:00:00Z`) : new Date();
const run = (args) => execFileSync(args[0], args.slice(1), { cwd: root, stdio: "inherit" });
const dateLabel = new Intl.DateTimeFormat("en-US", {
  weekday: "short", month: "short", day: "2-digit", timeZone: "UTC",
}).format(runDate).toUpperCase();
const journal = readFileSync(resolve(root, "content/journal.ts"), "utf8");
const runWithRetry = (args, attempts = 3) => {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      run(args);
      return;
    } catch (error) {
      if (attempt === attempts) throw error;
      console.warn(`${args.join(" ")} failed (attempt ${attempt}/${attempts}); regenerating.`);
    }
  }
};
const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "America/New_York" }).format(runDate);

await verifyWallyModel();

if (journal.includes(`date: "${dateLabel}"`)) {
  throw new Error(`A public Wally entry already exists for ${dateLabel}; refusing a duplicate daily cycle.`);
}

run(["npm", "run", "wally:feedback"]);
runWithRetry(["npm", "run", "wally:research"], 2);
runWithRetry(["npm", "run", "wally:conversation"], 2);
if (weekday === "Sunday") {
  run(["npm", "run", "wally:weekly"]);
  process.exit(0);
}
runWithRetry(["npm", "run", "wally:portfolio"]);
runWithRetry(["npm", "run", "wally:draft"]);
run(["npm", "run", "wally:experiment", "--", "--approve"]);
run(["npm", "run", "wally:apply", "--", "--approve"]);
run(["npm", "run", "build"]);
run(["npm", "run", "wally:memory"]);

const changed = execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim();
if (!changed) throw new Error("Wally produced no repository changes; deployment skipped.");
if (dryRun) {
  run(["npm", "run", "wally:bluesky"]);
  console.log("Wally dry run complete; commit, push, deployment, and social publishing skipped.");
  process.exit(0);
}

run(["git", "add", "content", "wiki", "public/experiments"]);
run(["git", "commit", "-m", "Run Wally daily experiment"]);
run(["git", "push", "origin", "main"]);
run(["npm", "run", "cf:deploy"]);
run(["npm", "run", "wally:bluesky", "--", "--publish"]);

const socialChanged = execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim();
if (socialChanged) {
  run(["git", "add", "wiki/social"]);
  run(["git", "commit", "-m", "Record Wally Bluesky post"]);
  run(["git", "push", "origin", "main"]);
}

const log = readFileSync(resolve(root, "wiki", "log.md"), "utf8");
console.log(`Wally daily cycle complete. Wiki log size: ${log.length} bytes.`);
