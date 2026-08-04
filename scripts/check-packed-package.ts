import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { repoRoot } from "./api-snapshot.ts";

/**
 * Both linters run against one packed tarball rather than the working tree, so
 * what they judge is exactly the byte stream a consumer installs: the packed
 * file list, the resolved `exports` map, and the shipped declarations.
 */
const workspace = mkdtempSync(join(tmpdir(), "scheme-tokens-package-"));
const packDirectory = join(workspace, "pack");
mkdirSync(packDirectory, { recursive: true });
const tarball = pack(packDirectory);
process.stdout.write(`Packed ${basename(tarball)}\n`);

runNodeBin(join(repoRoot, "node_modules", "publint", "src", "cli.js"), [
  "run",
  tarball,
  "--strict",
]);
runNodeBin(join(repoRoot, "node_modules", "@arethetypeswrong", "cli", "dist", "index.js"), [
  tarball,
  "--profile",
  "esm-only",
]);

function pack(destination: string): string {
  const output = runPnpm(["pack", "--pack-destination", destination]).trim().split(/\r?\n/).at(-1);
  if (output === undefined) {
    throw new Error("Unable to determine packed tarball name");
  }
  return join(destination, basename(output));
}

function runNodeBin(binPath: string, args: readonly string[]): void {
  execFileSync(process.execPath, [binPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "inherit", "inherit"],
  });
}

function runPnpm(args: readonly string[]): string {
  const npmExecPath = process.env.npm_execpath;
  return execFileSync(
    npmExecPath === undefined ? "pnpm" : process.execPath,
    npmExecPath === undefined ? args : [npmExecPath, ...args],
    { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
}
