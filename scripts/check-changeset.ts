import { execFileSync } from "node:child_process";
import { repoRoot, snapshotLabel } from "./api-snapshot.ts";

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

const changedFiles = git(["diff", "--name-only", `${baseRef}...HEAD`])
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.length > 0);

const snapshotChanged = changedFiles.includes(snapshotLabel);
const changesets = changedFiles.filter(
  (file) =>
    file.startsWith(".changeset/") && file.endsWith(".md") && file !== ".changeset/README.md",
);

if (!snapshotChanged) {
  process.stdout.write(`${snapshotLabel} is unchanged against ${baseRef}.\n`);
  process.exit(0);
}

if (changesets.length === 0) {
  throw new Error(
    `${snapshotLabel} changed against ${baseRef} without a changeset.\n` +
      "The published type surface moved, so the release needs a version bump and a\n" +
      "changelog entry. Run `pnpm changeset` and commit the generated file.",
  );
}

process.stdout.write(
  `${snapshotLabel} changed against ${baseRef}, covered by: ${changesets.join(", ")}\n`,
);

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
