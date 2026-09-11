#!/usr/bin/env node
/**
 * Fails the build if anything that looks like a credential is committed.
 *
 * This repo is PUBLIC. A leaked key here is not a private embarrassment, it is
 * an immediate public disclosure — so the check runs on every push rather than
 * relying on anybody remembering.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const PATTERNS = [
  [/\bsk-[A-Za-z0-9]{20,}/, "OpenAI-style key"],
  [/\bsk-ant-[A-Za-z0-9-]{20,}/, "Anthropic key"],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}/, "GitHub token"],
  [/\bEAA[A-Za-z0-9]{40,}/, "Meta access token"],
  [/\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./, "JWT"],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}/, "Slack token"],
  [/postgres(ql)?:\/\/[^\s"']*:[^\s"']+@/, "database URL with password"],
  [/\b[a-f0-9]{64}\b/, "64-hex string (possible API key)"],
];

const SKIP = new Set([".git", "node_modules"]);
const offenders = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) { walk(full); continue; }
    if (!/\.(mjs|js|ts|json|ya?ml|md|sh|env.*)$/.test(entry)) continue;
    const src = readFileSync(full, "utf8");
    for (const [re, label] of PATTERNS) {
      // A secrets reference in a workflow is correct; a literal is not.
      const m = src.match(re);
      if (m && !src.includes(`secrets.`)) offenders.push(`${full}: ${label}`);
      else if (m && !/\$\{\{\s*secrets\./.test(src.slice(Math.max(0, m.index - 120), m.index))) {
        offenders.push(`${full}: ${label}`);
      }
    }
  }
}

walk(process.cwd());
if (offenders.length) {
  console.error("SECRETS DETECTED IN A PUBLIC REPO:\n" + offenders.map((o) => "  " + o).join("\n"));
  process.exit(1);
}
console.log("no secrets in tree");
