// @ts-nocheck
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const workspace = mkdtempSync(join(tmpdir(), "color-scheme-tokens-tarball-"));
const packDirectory = join(workspace, "pack");
mkdirSync(packDirectory, { recursive: true });
const output = runPnpm(["pack", "--pack-destination", packDirectory], repoRoot)
  .trim()
  .split(/\r?\n/)
  .at(-1);
if (output === undefined) throw new Error("Unable to determine packed tarball name");
const tarball = join(packDirectory, basename(output));
const files = execFileSync("tar", ["-tf", tarball], { encoding: "utf8" }).trim().split(/\r?\n/);

const denied = [
  /^package\/docs\//,
  /^package\/src\//,
  /^package\/tests\//,
  /^package\/scripts\//,
  /^package\/\.github\//,
  /SOURCE-CONVERSATION/i,
  /v1-migration/i,
];
for (const file of files) {
  if (denied.some((pattern) => pattern.test(file))) {
    throw new Error(`Unexpected file in tarball: ${file}`);
  }
  if (
    !(
      file === "package/package.json" ||
      file === "package/README.md" ||
      file === "package/CHANGELOG.md" ||
      file === "package/LICENSE" ||
      file.startsWith("package/dist/") ||
      file.startsWith("package/schemas/")
    )
  ) {
    throw new Error(`File is not in the tarball allowlist: ${file}`);
  }
}

const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
if (packageJson.files.includes("docs")) throw new Error("package files must not include docs");

function runPnpm(args, cwd) {
  const npmExecPath = process.env.npm_execpath;
  return npmExecPath === undefined
    ? execFileSync("pnpm", args, { cwd, encoding: "utf8" })
    : execFileSync(process.execPath, [npmExecPath, ...args], { cwd, encoding: "utf8" });
}
