import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { packageRoot, repoRoot } from "./api-snapshot.ts";

const workspace = mkdtempSync(join(tmpdir(), "scheme-tokens-material3-package-"));
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
  const output = runPnpm(["pack", "--pack-destination", destination]).trim().split(/\r?\n/u).at(-1);
  if (output === undefined) {
    throw new Error("Unable to determine adapter tarball name");
  }
  return join(destination, basename(output));
}

function runNodeBin(binPath: string, args: readonly string[]): void {
  execFileSync(process.execPath, [binPath, ...args], {
    cwd: packageRoot,
    encoding: "utf8",
    stdio: ["ignore", "inherit", "inherit"],
  });
}

function runPnpm(args: readonly string[]): string {
  const npmExecPath = process.env.npm_execpath;
  return execFileSync(
    npmExecPath === undefined ? "pnpm" : process.execPath,
    npmExecPath === undefined ? args : [npmExecPath, ...args],
    { cwd: packageRoot, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
}
