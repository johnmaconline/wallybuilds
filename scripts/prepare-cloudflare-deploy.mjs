#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";

const configPath = new URL("../dist/server/wrangler.json", import.meta.url);
const config = JSON.parse(readFileSync(configPath, "utf8"));
config.name = "wallybuilds";
config.d1_databases = [{
  binding: "DB",
  database_name: "wallybuilds-submissions",
  database_id: "6d89da75-d66a-48d1-bde2-e03a2f876eb2",
  migrations_dir: "../../drizzle",
}];
writeFileSync(configPath, JSON.stringify(config));
