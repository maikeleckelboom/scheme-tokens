import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

interface CandidateSource {
  readonly patch: Buffer;
  readonly provenance: {
    readonly sourceCommit: string;
    readonly sourceDiffSha256: string;
    readonly sourceStatus: string;
    readonly sourceFiles: Readonly<Record<string, string>>;
  };
}

/** Git's patch is binary data. Only scalar identifiers may be trimmed. */
export function captureCandidateSource(root: string): CandidateSource {
  const git = (...args: string[]): Buffer => execFileSync("git", args, { cwd: root });
  const untracked = [
    ...new Set([
      ...git("ls-files", "--others", "--exclude-standard", "-z").toString("utf8").split("\0"),
      // An ignored authored input still affects the build/version projection and is not in a patch.
      ...git(
        "ls-files",
        "--others",
        "-z",
        "--",
        "src",
        "packages/material3/src",
        "schemas",
        ".changeset",
      )
        .toString("utf8")
        .split("\0"),
    ]),
  ]
    .filter(Boolean)
    .sort();
  if (untracked.length > 0) {
    throw new Error(
      `Candidate provenance cannot reconstruct non-ignored untracked inputs or ignored source/versioning inputs. Track them or move them outside the source tree before packing:\n${untracked.join("\n")}`,
    );
  }
  const patch = git("diff", "HEAD", "--binary", "--no-ext-diff", "--no-textconv");
  return {
    patch,
    provenance: {
      sourceCommit: git("rev-parse", "HEAD").toString("utf8").trim(),
      sourceDiffSha256: sha256(patch),
      sourceStatus: git("status", "--porcelain").toString("utf8"),
      sourceFiles: Object.fromEntries(
        git("ls-files", "-z")
          .toString("utf8")
          .split("\0")
          .filter((path) => path.length > 0 && existsSync(join(root, path)))
          .map((path) => [path, sha256(readFileSync(join(root, path)))]),
      ),
    },
  };
}

export function writeCandidatePatch(workspace: string, patch: Buffer): void {
  writeFileSync(join(workspace, "source.patch"), patch);
}

export function createFreshCandidateDirectory(workspace: string): void {
  mkdirSync(workspace, { recursive: true });
  if (readdirSync(workspace).length > 0) {
    throw new Error(
      `Candidate output directory must be empty: ${workspace}. Use a fresh directory.`,
    );
  }
}

export function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
