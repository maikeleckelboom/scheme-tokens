import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

interface PackageManifest {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
  readonly peerDependencies?: Readonly<Record<string, string>>;
  readonly files: readonly string[];
}

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const workspace = mkdtempSync(join(tmpdir(), "color-scheme-tokens-material3-tarball-"));
const packDirectory = join(workspace, "pack");
mkdirSync(packDirectory, { recursive: true });

const output = runPnpm(["pack", "--pack-destination", packDirectory], packageRoot)
  .trim()
  .split(/\r?\n/)
  .at(-1);
if (output === undefined) {
  throw new Error("Unable to determine packed adapter tarball name");
}

const tarball = join(packDirectory, basename(output));
const files = execFileSync("tar", ["-tf", tarball], { encoding: "utf8" }).trim().split(/\r?\n/);
const denied = [
  /^package\/src\//,
  /^package\/tests\//,
  /^package\/scripts\//,
  /^package\/\.\.\/\.\.\//,
  /SOURCE-CONVERSATION/i,
];

for (const file of files) {
  if (denied.some((pattern) => pattern.test(file))) {
    throw new Error(`Unexpected file in adapter tarball: ${file}`);
  }
  if (
    !(
      file === "package/package.json" ||
      file === "package/README.md" ||
      file === "package/LICENSE" ||
      file.startsWith("package/dist/")
    )
  ) {
    throw new Error(`File is not in the adapter tarball allowlist: ${file}`);
  }
}

const manifest = JSON.parse(
  readFileSync(join(packageRoot, "package.json"), "utf8"),
) as PackageManifest;
if (!manifest.files.includes("dist")) {
  throw new Error("adapter package files must include dist");
}
if (manifest.dependencies?.["@material/material-color-utilities"] !== "0.4.0") {
  throw new Error(
    "adapter package must exact-pin @material/material-color-utilities as a runtime dependency",
  );
}
if (manifest.devDependencies?.["@material/material-color-utilities"] !== undefined) {
  throw new Error("adapter package must not duplicate the Material engine in devDependencies");
}
if (manifest.peerDependencies?.["color-scheme-tokens"] !== "0.0.0") {
  throw new Error("adapter package must peer-depend on color-scheme-tokens");
}
if (manifest.devDependencies?.["color-scheme-tokens"] !== "workspace:*") {
  throw new Error("adapter package must use color-scheme-tokens as a workspace dev dependency");
}

function runPnpm(args: readonly string[], cwd: string): string {
  const npmExecPath = process.env.npm_execpath;
  return npmExecPath === undefined
    ? execFileSync("pnpm", args, { cwd, encoding: "utf8" })
    : execFileSync(process.execPath, [npmExecPath, ...args], { cwd, encoding: "utf8" });
}
