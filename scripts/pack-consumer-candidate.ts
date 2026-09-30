import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { packReleaseCandidate } from "../packages/material3/scripts/release-candidate.ts";

const destination = process.argv[2];
if (destination === undefined) {
  throw new Error("Usage: pnpm candidate:pack <output-directory>");
}
const workspace = resolve(destination);
mkdirSync(workspace, { recursive: true });
const sourceCommit = git("rev-parse", "HEAD");
const sourceDiff = git("diff", "HEAD", "--binary");
const candidate = packReleaseCandidate(workspace);
const provenance = {
  sourceCommit,
  sourceDiffSha256: hash(sourceDiff),
  sourceStatus: git("status", "--porcelain"),
  sourceFiles: Object.fromEntries(
    git(
      "ls-files",
      "src",
      "packages/material3/src",
      "schemas",
      ".changeset",
      "package.json",
      "packages/material3/package.json",
      "pnpm-lock.yaml",
      "tsdown.config.ts",
      "packages/material3/tsdown.config.ts",
    )
      .split("\n")
      .filter(Boolean)
      .map((path) => [path, hash(readFileSync(path))]),
  ),
  node: process.version,
  packageManager: JSON.parse(readFileSync("package.json", "utf8")).packageManager,
  procedure: "packReleaseCandidate: build, temporary Changesets version, strict-peer install, pack",
  versions: candidate.versions,
  materialCorePeer: "^0.4.0",
  artifacts: [candidate.coreTarball, candidate.adapterTarball].map((path) => ({
    filename: basename(path),
    sha256: hash(readFileSync(path)),
  })),
};
writeFileSync(join(workspace, "provenance.json"), `${JSON.stringify(provenance, null, 2)}\n`);
writeFileSync(join(workspace, "source.patch"), sourceDiff);
process.stdout.write(`${JSON.stringify(provenance, null, 2)}\n`);

function git(...args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function hash(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
