#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const siteUrl = process.env.WALLY_SITE_URL ?? "https://wallybuilds.ancient-feather-940d.workers.dev";
const response = await fetch(`${siteUrl}/api/experiments/events`);
if (!response.ok) throw new Error(`Could not read feedback (${response.status}).`);
const { events = [] } = await response.json();
const lines = events.length ? events.map((event) => `- ${event.slug}: ${event.eventType} = ${event.count}`).join("\n") : "- No aggregate interaction events yet.";
const output = `# Latest feedback snapshot\n\nUpdated: ${new Date().toISOString()}\n\n${lines}\n\nInterpretation: opens, starts, and completions are signals to investigate—not market validation.\n`;
mkdirSync(resolve(root, "wiki", "feedback"), { recursive: true });
writeFileSync(resolve(root, "wiki", "feedback", "latest.md"), output);
console.log("Feedback snapshot updated.");
