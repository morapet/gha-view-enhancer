#!/usr/bin/env node
/**
 * validate-manifest.js
 *
 * Validates manifest.json for required MV3 fields.
 * Exits with code 1 and a clear message on failure.
 */

"use strict";

const fs   = require("fs");
const path = require("path");

const manifestPath = path.resolve(__dirname, "..", "manifest.json");

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
} catch (err) {
  console.error(`ERROR: manifest.json is not valid JSON.\n  ${err.message}`);
  process.exit(1);
}

let ok = true;

if (manifest.manifest_version !== 3) {
  console.error(
    `ERROR: manifest_version must be 3, got: ${manifest.manifest_version}`
  );
  ok = false;
}

if (!manifest.name || typeof manifest.name !== "string" || manifest.name.trim() === "") {
  console.error("ERROR: manifest.json must have a non-empty 'name' field.");
  ok = false;
}

const versionRe = /^\d+(\.\d+){0,3}$/;
if (!manifest.version || !versionRe.test(manifest.version)) {
  console.error(
    `ERROR: manifest.json 'version' must be a dot-separated integer string (e.g. "0.1.0"), got: ${manifest.version}`
  );
  ok = false;
}

if (!ok) process.exit(1);

console.log(
  `manifest.json OK  (manifest_version=${manifest.manifest_version}, name="${manifest.name}", version="${manifest.version}")`
);
