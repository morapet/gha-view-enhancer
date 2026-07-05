#!/usr/bin/env node
/**
 * package.js
 *
 * Packages the extension distributable files into gha-view-enhancer.zip.
 * Excludes dev files: node_modules, .github, scripts, package*.json,
 * .eslintrc*, test files, etc.
 */

"use strict";

const fs           = require("fs");
const path         = require("path");
const { execSync } = require("child_process");

const ROOT    = path.resolve(__dirname, "..");
const OUTFILE = path.join(ROOT, "gha-view-enhancer.zip");

// Files/directories to include (relative to repo root).
const INCLUDE = [
  "manifest.json",
  "styles.css",
  "src",
  "icons",
];

// Remove existing zip if present.
if (fs.existsSync(OUTFILE)) {
  fs.unlinkSync(OUTFILE);
  console.log(`Removed existing ${OUTFILE}`);
}

const paths = INCLUDE.join(" ");
const cmd   = `zip -r "${OUTFILE}" ${paths}`;
console.log(`Running: ${cmd}`);
execSync(cmd, { cwd: ROOT, stdio: "inherit" });
console.log(`\nCreated: ${OUTFILE}`);
