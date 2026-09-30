import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

const consumer = process.argv[2];
if (consumer === undefined) {
  throw new Error("Usage: node scripts/check-consumer-candidate.ts <consumer-directory>");
}
const root = resolve(consumer);
const require = createRequire(join(root, "package.json"));
const corePath = require.resolve("scheme-tokens/package.json");
const materialPath = require.resolve("@scheme-tokens/material3/package.json");
const peerPath = createRequire(materialPath).resolve("scheme-tokens/package.json");
assert.equal(
  realpathSync(peerPath),
  realpathSync(corePath),
  "Material resolves the installed candidate core",
);
const core = JSON.parse(readFileSync(corePath, "utf8"));
const material = JSON.parse(readFileSync(materialPath, "utf8"));
assert.equal(core.version, "0.4.0");
assert.equal(material.version, "0.2.0");
assert.equal(material.peerDependencies["scheme-tokens"], "^0.4.0");
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const dependencies = { ...manifest.dependencies, ...manifest.devDependencies };
const provenance = JSON.parse(
  readFileSync(join(root, "vendor/scheme-tokens/provenance.json"), "utf8"),
) as {
  artifacts: { filename: string; sha256: string }[];
};
const lock = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
for (const [name, filename] of [
  ["scheme-tokens", "scheme-tokens-0.4.0.tgz"],
  ["@scheme-tokens/material3", "scheme-tokens-material3-0.2.0.tgz"],
] as const) {
  const spec = `file:vendor/scheme-tokens/${filename}`;
  assert.equal(dependencies[name], spec);
  assert(lock.includes(spec), `${name} lockfile uses the portable artifact`);
  const bytes = readFileSync(join(root, "vendor/scheme-tokens", filename));
  const digest = createHash("sha256").update(bytes).digest("hex");
  assert.equal(provenance.artifacts.find((entry) => entry.filename === filename)?.sha256, digest);
  const integrity = createHash("sha512").update(bytes).digest("base64");
  assert(lock.includes(`sha512-${integrity}`), `${name} lockfile integrity matches artifact bytes`);
}
console.log(
  "Candidate hashes, portable manifest/lockfile resolutions, versions, and shared Material peer passed.",
);
