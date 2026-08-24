import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot, snapshotLabel as coreSnapshotLabel } from "./api-snapshot.ts";

const snapshots = [
  {
    label: coreSnapshotLabel,
    packageName: "scheme-tokens",
    manifest: "package.json",
    changelog: "CHANGELOG.md",
  },
  {
    label: "packages/material3/api/material3.api.d.ts",
    packageName: "@scheme-tokens/material3",
    manifest: "packages/material3/package.json",
    changelog: "packages/material3/CHANGELOG.md",
  },
] as const;

/**
 * The API snapshot is the published type surface. When a branch moves it
 * without adding a changeset or applying it to release metadata, the package
 * ships a contract change with no version bump and no changelog entry. That is
 * exactly the drift the snapshot exists to prevent.
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
    file.startsWith(".changeset/") &&
    file.endsWith(".md") &&
    file !== ".changeset/README.md" &&
    existsSync(join(repoRoot, file)),
);

for (const snapshot of snapshots) {
  if (!changedFiles.includes(snapshot.label)) {
    process.stdout.write(`${snapshot.label} is unchanged against ${baseRef}.\n`);
    continue;
  }

  const coveringChangesets = changesets.filter((path) =>
    readFileSync(join(repoRoot, path), "utf8").includes(`"${snapshot.packageName}":`),
  );
  if (coveringChangesets.length > 0) {
    process.stdout.write(
      `${snapshot.label} changed against ${baseRef}, covered by: ${coveringChangesets.join(", ")}\n`,
    );
    continue;
  }

  const appliedVersion = appliedReleaseVersion(snapshot, baseRef, changedFiles);
  if (appliedVersion !== undefined) {
    process.stdout.write(
      `${snapshot.label} changed against ${baseRef}, covered by applied ${snapshot.packageName}@${appliedVersion} release metadata.\n`,
    );
    continue;
  }

  throw new Error(
    `${snapshot.label} changed against ${baseRef} without release metadata for ${snapshot.packageName}.\n` +
      "The published type surface moved, so the affected package needs either a pending changeset\n" +
      "or an applied version bump with a matching changelog entry. Run `pnpm changeset` first.",
  );
}

function appliedReleaseVersion(
  snapshot: (typeof snapshots)[number],
  baseRef: string,
  changedFiles: readonly string[],
): string | undefined {
  if (!changedFiles.includes(snapshot.manifest) || !changedFiles.includes(snapshot.changelog)) {
    return undefined;
  }

  const currentVersion = readPackageVersion(
    readFileSync(join(repoRoot, snapshot.manifest), "utf8"),
    snapshot.manifest,
  );
  const baseVersion = readPackageVersion(
    git(["show", `${baseRef}:${snapshot.manifest}`]),
    `${baseRef}:${snapshot.manifest}`,
  );
  if (currentVersion === baseVersion) {
    return undefined;
  }

  const changelogLines = readFileSync(join(repoRoot, snapshot.changelog), "utf8").split(/\r?\n/);
  return changelogLines.includes(`## ${currentVersion}`) ? currentVersion : undefined;
}

function readPackageVersion(source: string, label: string): string {
  const manifest: unknown = JSON.parse(source);
  if (typeof manifest !== "object" || manifest === null || Array.isArray(manifest)) {
    throw new Error(`${label} must contain a package manifest object.`);
  }
  const version = (manifest as Readonly<Record<string, unknown>>).version;
  if (typeof version !== "string" || version.length === 0) {
    throw new Error(`${label} must contain a non-empty version string.`);
  }
  return version;
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
