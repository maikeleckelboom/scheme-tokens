import { readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { repoRoot } from "./api-snapshot.ts";
import {
  captureCandidateSource,
  createFreshCandidateDirectory,
  sha256,
  writeCandidatePatch,
} from "./consumer-candidate-source.ts";
import { packReleaseCandidate } from "../packages/material3/scripts/release-candidate.ts";

const destination = process.argv[2];
if (destination === undefined) {
  throw new Error("Usage: pnpm candidate:pack <output-directory>");
}
const workspace = resolve(destination);
createFreshCandidateDirectory(workspace);
const source = captureCandidateSource(repoRoot);
const candidate = packReleaseCandidate(workspace);
const provenance = {
  ...source.provenance,
  node: process.version,
  packageManager: JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")).packageManager,
  procedure: "packReleaseCandidate: build, temporary Changesets version, strict-peer install, pack",
  versions: candidate.versions,
  materialCorePeer: "^0.4.0",
  artifacts: [candidate.coreTarball, candidate.adapterTarball].map((path) => ({
    filename: basename(path),
    sha256: sha256(readFileSync(path)),
  })),
};
writeFileSync(join(workspace, "provenance.json"), `${JSON.stringify(provenance, null, 2)}\n`);
writeCandidatePatch(workspace, source.patch);
process.stdout.write(`${JSON.stringify(provenance, null, 2)}\n`);
