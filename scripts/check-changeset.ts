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
assertPullRequestHeadCheckout();
const baseRef = resolveBaseRef();
if (baseRef === undefined) {
  process.stdout.write(
    "No base ref to compare against; skipping the API surface changeset gate.\n",
  );
  process.exit(0);
}
const comparisonBase = git(["merge-base", baseRef, "HEAD"]);

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

  const appliedRelease = findAppliedRelease(snapshot, comparisonBase, changedFiles);
  if (appliedRelease !== undefined) {
    process.stdout.write(
      `${snapshot.label} changed against ${baseRef}, covered by applied ${snapshot.packageName}@${appliedRelease.version} release metadata at ${appliedRelease.boundary.slice(0, 12)}.\n`,
    );
    continue;
  }

  throw new Error(
    `${snapshot.label} changed against ${baseRef} without release metadata for ${snapshot.packageName}.\n` +
      "The published type surface moved, so the affected package needs either a pending changeset\n" +
      "or an applied version bump with a matching changelog entry. Run `pnpm changeset` first.",
  );
}

function findAppliedRelease(
  snapshot: (typeof snapshots)[number],
  comparisonBase: string,
  changedFiles: readonly string[],
): { readonly version: string; readonly boundary: string } | undefined {
  if (!changedFiles.includes(snapshot.manifest) || !changedFiles.includes(snapshot.changelog)) {
    return undefined;
  }

  const currentVersion = readPackageVersion(
    readFileSync(join(repoRoot, snapshot.manifest), "utf8"),
    snapshot.manifest,
  );
  const baseVersion = readPackageVersion(
    git(["show", `${comparisonBase}:${snapshot.manifest}`]),
    `${comparisonBase}:${snapshot.manifest}`,
  );
  if (currentVersion === baseVersion) {
    return undefined;
  }

  const boundary = findVersionBoundary(snapshot.manifest, comparisonBase, currentVersion);
  if (boundary === undefined) {
    return undefined;
  }

  const currentChangelog = readFileSync(join(repoRoot, snapshot.changelog), "utf8");
  const boundaryChangelog = gitRaw(["show", `${boundary}:${snapshot.changelog}`]);
  if (
    !hasVersionHeading(currentChangelog, currentVersion) ||
    !hasVersionHeading(boundaryChangelog, currentVersion)
  ) {
    return undefined;
  }

  const currentSnapshot = normalizeGitText(readFileSync(join(repoRoot, snapshot.label), "utf8"));
  const boundarySnapshot = normalizeGitText(gitRaw(["show", `${boundary}:${snapshot.label}`]));
  if (currentSnapshot !== boundarySnapshot) {
    throw new Error(
      `${snapshot.label} differs from the snapshot at the applied ${snapshot.packageName}@${currentVersion} release boundary ${boundary.slice(0, 12)}.\n` +
        "Applied release metadata covers only the API surface that existed when that version was created.\n" +
        `Add a pending changeset covering ${snapshot.packageName} before changing its API snapshot again.`,
    );
  }

  return { version: currentVersion, boundary };
}

function findVersionBoundary(
  manifest: string,
  comparisonBase: string,
  currentVersion: string,
): string | undefined {
  let previousVersion = readPackageVersion(
    git(["show", `${comparisonBase}:${manifest}`]),
    `${comparisonBase}:${manifest}`,
  );
  const boundaries: string[] = [];

  for (const commit of gitLines([
    "rev-list",
    "--first-parent",
    "--reverse",
    `${comparisonBase}..HEAD`,
  ])) {
    const version = readPackageVersion(
      git(["show", `${commit}:${manifest}`]),
      `${commit}:${manifest}`,
    );
    if (version === currentVersion && previousVersion !== currentVersion) {
      boundaries.push(commit);
    }
    previousVersion = version;
  }

  if (boundaries.length > 1) {
    throw new Error(
      `${manifest} transitions to ${currentVersion} more than once between ${comparisonBase.slice(0, 12)} and HEAD; cannot identify one release boundary.`,
    );
  }
  return boundaries[0];
}

function hasVersionHeading(changelog: string, version: string): boolean {
  return normalizeGitText(changelog).split("\n").includes(`## ${version}`);
}

function normalizeGitText(source: string): string {
  return source.replaceAll("\r\n", "\n");
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

function assertPullRequestHeadCheckout(): void {
  if (process.env.GITHUB_EVENT_NAME !== "pull_request") {
    return;
  }

  const eventRef = process.env.GITHUB_REF;
  const eventSha = process.env.GITHUB_SHA;
  if (
    eventRef === undefined ||
    !/^refs\/pull\/\d+\/merge$/u.test(eventRef) ||
    eventSha === undefined ||
    eventSha.length === 0
  ) {
    return;
  }

  const head = git(["rev-parse", "HEAD"]);
  if (head.toLowerCase() !== eventSha.toLowerCase()) {
    return;
  }

  throw new Error(
    "check:changeset cannot analyze GitHub's synthetic pull-request merge commit.\n" +
      "The API contract job must check out github.event.pull_request.head.sha with fetch-depth: 0 before running this gate.",
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
  return gitRaw(args).trim();
}

function gitRaw(args: readonly string[]): string {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function gitLines(args: readonly string[]): readonly string[] {
  return git(args)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
