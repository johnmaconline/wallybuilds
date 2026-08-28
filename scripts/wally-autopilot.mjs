#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const run = (args) => execFileSync(args[0], args.slice(1), { cwd: root, stdio: "inherit" });
const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "America/New_York" }).format(new Date());

if (weekday === "Sunday") {
  run(["npm", "run", "wally:weekly"]);
  process.exit(0);
}

run(["npm", "run", "wally:feedback"]);
run(["npm", "run", "wally:portfolio"]);
run(["npm", "run", "wally:draft"]);
run(["npm", "run", "wally:experiment", "--", "--approve"]);
run(["npm", "run", "wally:apply", "--", "--approve"]);
run(["npm", "run", "build"]);

const changed = execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim();
if (!changed) throw new Error("Wally produced no repository changes; deployment skipped.");

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
