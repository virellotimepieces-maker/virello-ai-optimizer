#!/usr/bin/env node
/**
 * Scans tracked source for credential-like patterns.
 * Reports file paths only. Never prints matched secret text.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const patterns = [
  /sk_live_[A-Za-z0-9]{8,}/,
  /sk_test_[A-Za-z0-9]{8,}/,
  /whsec_[A-Za-z0-9]{8,}/,
  /rk_live_[A-Za-z0-9]{8,}/,
  /shpat_[A-Za-z0-9]{8,}/,
  /shpss_[A-Za-z0-9]{8,}/,
  /-----BEGIN (RSA |OPENSSH )?PRIVATE KEY-----/,
];

const files = execSync("git ls-files", { encoding: "utf8" })
  .split("\n")
  .filter(Boolean)
  .filter(
    (file) =>
      file !== "package-lock.json" &&
      !file.endsWith(".png") &&
      !file.endsWith(".ico") &&
      !file.endsWith(".zip")
  );

const hits = [];

for (const file of files) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }

  if (patterns.some((pattern) => pattern.test(text))) {
    hits.push(file);
  }
}

if (hits.length) {
  console.error("Potential secret material in tracked files:");
  for (const file of hits) console.error(`- ${file}`);
  process.exit(1);
}

console.log(
  "security:check passed (no credential-like values in tracked files)"
);
