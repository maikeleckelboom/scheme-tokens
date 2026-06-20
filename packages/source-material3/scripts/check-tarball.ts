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
  readonly private?: boolean;
  readonly publishConfig?: Readonly<Record<string, string>>;
  readonly version: string;
}

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const workspace = mkdtempSync(join(tmpdir(), "scheme-tokens-material3-tarball-"));
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
      file === "package/NOTICE.md" ||
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
if (manifest.version !== "0.1.0") {
  throw new Error("adapter package version must be 0.1.0 for the first public release candidate");
}
if (manifest.private !== undefined) {
  throw new Error("adapter package must not be private when checking the public tarball");
}
if (manifest.publishConfig?.access !== "public") {
  throw new Error("scoped adapter package must publish with public access");
}
if (!manifest.files.includes("dist")) {
  throw new Error("adapter package files must include dist");
}
if (!manifest.files.includes("NOTICE.md")) {
  throw new Error("adapter package files must include third-party notices for bundled engine code");
}
const noticeText = readFileSync(join(packageRoot, "NOTICE.md"), "utf8");
if (
  !noticeText.includes("@material/material-color-utilities@0.4.0") ||
  !noticeText.includes("Apache License, Version 2.0") ||
  !noticeText.includes("Copyright 2021 Google LLC")
) {
  throw new Error("adapter third-party notice must cover the bundled Material engine");
}
if (manifest.dependencies?.["@material/material-color-utilities"] !== "0.4.0") {
  throw new Error(
    "adapter package must exact-pin @material/material-color-utilities as a runtime dependency",
  );
}
if (manifest.devDependencies?.["@material/material-color-utilities"] !== undefined) {
  throw new Error("adapter package must not duplicate the Material engine in devDependencies");
}
if (manifest.peerDependencies?.["scheme-tokens"] !== "^0.1.0") {
  throw new Error("adapter package must peer-depend on scheme-tokens");
}
if (manifest.devDependencies?.["scheme-tokens"] !== "workspace:*") {
  throw new Error("adapter package must use scheme-tokens as a workspace dev dependency");
}
if (
  JSON.stringify(manifest.dependencies ?? {}).includes("workspace:") ||
  JSON.stringify(manifest.peerDependencies ?? {}).includes("workspace:")
) {
  throw new Error("adapter runtime dependency fields must not leak workspace protocols");
}

const bundleText = readFileSync(join(packageRoot, "dist", "index.js"), "utf8");
const sourceMapText = readFileSync(join(packageRoot, "dist", "index.js.map"), "utf8");
if (!bundleText.includes("@material+material-color-utilities")) {
  throw new Error(
    "adapter bundle must inline the Material engine for Node-compatible runtime imports",
  );
}
if (
  !sourceMapText.includes("node_modules/.pnpm/@material+material-color-utilities") &&
  !sourceMapText.includes("node_modules/@material/material-color-utilities")
) {
  throw new Error("adapter source map must preserve bundled Material engine provenance");
}

function runPnpm(args: readonly string[], cwd: string): string {
  const npmExecPath = process.env.npm_execpath;
  return npmExecPath === undefined
    ? execFileSync("pnpm", args, { cwd, encoding: "utf8" })
    : execFileSync(process.execPath, [npmExecPath, ...args], { cwd, encoding: "utf8" });
}
