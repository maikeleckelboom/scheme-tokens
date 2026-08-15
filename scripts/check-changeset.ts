import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot, snapshotLabel as coreSnapshotLabel } from "./api-snapshot.ts";

const snapshots = [
  { label: coreSnapshotLabel, packageName: "scheme-tokens" },
  {
    label: "packages/material3/api/material3.api.d.ts",
    packageName: "@scheme-tokens/material3",
  },
] as const;

/**
 * The API snapshot is the published type surface. When a branch moves it
 * without adding a changeset, the package ships a contract change with no
 * version bump and no changelog entry, which is exactly the drift the snapshot
 * exists to prevent.
 */
const baseRef = resolveBaseRef();
if (baseRef === undefined) {
  process.stdout.write(
    "No base ref to compare against; skipping the API surface changeset gate.\n",
  );
  process.exit(0);
}

const changedFiles = [
  ...new Set([
    ...gitLines(["diff", "--name-only", `${baseRef}...HEAD`]),
    ...gitLines(["diff", "--name-only"]),
    ...gitLines(["diff", "--name-only", "--cached"]),
    ...gitLines(["ls-files", "--others", "--exclude-standard"]),
  ]),
].sort();

const changesets = changedFiles.filter(
  (file) =>
    file.startsWith(".changeset/") && file.endsWith(".md") && file !== ".changeset/README.md",
);

for (const snapshot of snapshots) {
  if (!changedFiles.includes(snapshot.label)) {
    process.stdout.write(`${snapshot.label} is unchanged against ${baseRef}.\n`);
    continue;
  }

  const coveringChangesets = changesets.filter((path) =>
    readFileSync(join(repoRoot, path), "utf8").includes(`"${snapshot.packageName}":`),
  );
  if (coveringChangesets.length === 0) {
    throw new Error(
      `${snapshot.label} changed against ${baseRef} without a ${snapshot.packageName} changeset.\n` +
        "The published type surface moved, so the affected package needs a version bump and a\n" +
        "changelog entry. Run `pnpm changeset` and commit the generated file.",
    );
  }

  process.stdout.write(
    `${snapshot.label} changed against ${baseRef}, covered by: ${coveringChangesets.join(", ")}\n`,
  );
}

function resolveBaseRef(): string | undefined {
  const pullRequestBase = process.env.GITHUB_BASE_REF;
  if (pullRequestBase !== undefined && pullRequestBase.length > 0) {
    return resolveRef(`origin/${pullRequestBase}`);
  }
  return resolveRef("origin/main") ?? resolveRef("main");
}

function resolveRef(ref: string): string | undefined {
  try {
    git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
    return ref;
  } catch {
    return undefined;
  }
}

function git(args: readonly string[]): string {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function gitLines(args: readonly string[]): readonly string[] {
  return git(args)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
