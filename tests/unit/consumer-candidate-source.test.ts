import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { packReleaseCandidate } from "../../packages/material3/scripts/release-candidate.ts";
import {
  captureCandidateSource,
  createFreshCandidateDirectory,
  sha256,
  writeCandidatePatch,
} from "../../scripts/consumer-candidate-source.ts";

const workspaces: string[] = [];
afterEach(() => {
  for (const workspace of workspaces.splice(0)) {
    rmSync(workspace, { recursive: true, force: true });
  }
});

function fixture() {
  const workspace = mkdtempSync(join(tmpdir(), "scheme-tokens-patch-test-"));
  workspaces.push(workspace);
  const source = join(workspace, "source");
  mkdirSync(source);
  const git = (...args: string[]) => execFileSync("git", args, { cwd: source });
  git("init", "--quiet");
  git("config", "core.autocrlf", "false");
  writeFileSync(join(source, ".gitignore"), "ignored/\nsrc/hidden.ts\n");
  writeFileSync(join(source, "input.txt"), "first\nlast\n");
  writeFileSync(join(source, "bytes.bin"), Buffer.from([0, 255, 128, 13, 10]));
  git("add", ".");
  git(
    "-c",
    "user.name=Candidate test",
    "-c",
    "user.email=candidate@example.invalid",
    "commit",
    "--quiet",
    "-m",
    "baseline",
  );
  return { workspace, source, git };
}

describe("verbatim candidate source capture", () => {
  it("hashes and saves the exact patch bytes and reconstructs whitespace and binary modifications", () => {
    const { workspace, source, git } = fixture();
    writeFileSync(join(source, "input.txt"), " first\r\nlast  \t\n\n");
    writeFileSync(join(source, "bytes.bin"), Buffer.from([0, 254, 129, 13, 10, 0, 255]));
    const captured = captureCandidateSource(source);
    const output = join(workspace, "output");
    createFreshCandidateDirectory(output);
    writeCandidatePatch(output, captured.patch);
    const saved = readFileSync(join(output, "source.patch"));
    expect(saved).toEqual(git("diff", "HEAD", "--binary", "--no-ext-diff", "--no-textconv"));
    expect(saved.at(-1)).toBe(10);
    expect(saved.toString("utf8")).toContain("GIT binary patch");
    expect(sha256(saved)).toBe(captured.provenance.sourceDiffSha256);
    expect(captured.provenance.sourceFiles["input.txt"]).toBe(
      sha256(readFileSync(join(source, "input.txt"))),
    );
    const reconstructed = join(workspace, "reconstructed");
    execFileSync("git", ["clone", "--quiet", "--no-hardlinks", source, reconstructed]);
    expect(
      execFileSync("git", ["rev-parse", "HEAD"], { cwd: reconstructed }).toString("utf8").trim(),
    ).toBe(captured.provenance.sourceCommit);
    execFileSync("git", ["apply", "--check", join(output, "source.patch")], { cwd: reconstructed });
    execFileSync("git", ["apply", "--whitespace=nowarn", join(output, "source.patch")], {
      cwd: reconstructed,
    });
    for (const filename of ["input.txt", "bytes.bin"]) {
      expect(readFileSync(join(reconstructed, filename))).toEqual(
        readFileSync(join(source, filename)),
      );
    }
  });

  it("writes a zero-byte patch and its digest for an empty diff", () => {
    const { workspace, source } = fixture();
    const captured = captureCandidateSource(source);
    writeCandidatePatch(workspace, captured.patch);
    expect(readFileSync(join(workspace, "source.patch"))).toEqual(Buffer.alloc(0));
    expect(captured.provenance.sourceDiffSha256).toBe(sha256(Buffer.alloc(0)));
    expect(captured.provenance.sourceStatus).toBe("");
  });

  it("rejects untracked inputs, includes staged additions, and permits ignored output", () => {
    const { source, git } = fixture();
    writeFileSync(join(source, "new-input.txt"), "new\n");
    expect(() => captureCandidateSource(source)).toThrow("non-ignored untracked inputs");
    expect(() => captureCandidateSource(source)).toThrow("new-input.txt");
    git("add", "new-input.txt");
    mkdirSync(join(source, "ignored"));
    writeFileSync(join(source, "ignored", "build.txt"), "ignored");
    const captured = captureCandidateSource(source);
    expect(captured.patch.toString("utf8")).toContain("new-input.txt");
    expect(captured.provenance.sourceFiles["new-input.txt"]).toBe(sha256(Buffer.from("new\n")));
    expect(captured.provenance.sourceFiles["ignored/build.txt"]).toBeUndefined();
  });

  it("rejects ignored untracked authored inputs too", () => {
    const { source } = fixture();
    mkdirSync(join(source, "src"));
    writeFileSync(join(source, "src", "hidden.ts"), "export const input = 1;\n");
    expect(() => captureCandidateSource(source)).toThrow("ignored source/versioning inputs");
    expect(() => captureCandidateSource(source)).toThrow("src/hidden.ts");
  });

  it("rejects stale output and shared candidate staging before building", () => {
    const { workspace } = fixture();
    expect(() => createFreshCandidateDirectory(workspace)).toThrow("must be empty");
    const output = join(workspace, "output");
    createFreshCandidateDirectory(output);
    mkdirSync(join(output, "release-candidate"));
    expect(() => packReleaseCandidate(output)).toThrow("staging directories already exist");
    const other = join(workspace, "other");
    mkdirSync(join(other, "pack"), { recursive: true });
    expect(() => packReleaseCandidate(other)).toThrow("staging directories already exist");
  });
});
