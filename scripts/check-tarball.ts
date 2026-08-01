import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

interface PackageManifest {
  readonly bugs: { readonly url: string };
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly exports: Readonly<Record<string, unknown>>;
  readonly files: readonly string[];
  readonly homepage: string;
  readonly name: string;
  readonly optionalDependencies?: Readonly<Record<string, string>>;
  readonly peerDependencies?: Readonly<Record<string, string>>;
  readonly private?: boolean;
  readonly publishConfig?: unknown;
  readonly repository: { readonly type: string; readonly url: string };
  readonly version: string;
}

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const workspace = mkdtempSync(join(tmpdir(), "scheme-tokens-tarball-"));
const packDirectory = join(workspace, "pack");
mkdirSync(packDirectory, { recursive: true });
const output = runPnpm(["pack", "--pack-destination", packDirectory], repoRoot)
  .trim()
  .split(/\r?\n/)
  .at(-1);
if (output === undefined) {
  throw new Error("Unable to determine packed tarball name");
}
const tarball = join(packDirectory, basename(output));
const files = execFileSync("tar", ["-tf", tarball], { encoding: "utf8" }).trim().split(/\r?\n/);
const allowedFiles = [
  "package/CHANGELOG.md",
  "package/LICENSE",
  "package/README.md",
  "package/dist/index.d.ts",
  "package/dist/index.js",
  "package/dist/index.js.map",
  "package/package.json",
  "package/schemas/compiled-scheme.v1.schema.json",
  "package/schemas/token-graph.v1.schema.json",
  "package/schemas/token-layer.v1.schema.json",
] as const;

const denied = [
  /^package\/docs\//,
  /^package\/src\//,
  /^package\/tests\//,
  /^package\/scripts\//,
  /^package\/packages\//,
  /^package\/\.github\//,
  /@material\/material-color-utilities/i,
  /material3/i,
  /SOURCE-CONVERSATION/i,
  /v1-migration/i,
];
for (const file of files) {
  if (denied.some((pattern) => pattern.test(file))) {
    throw new Error(`Unexpected file in tarball: ${file}`);
  }
  if (!(allowedFiles as readonly string[]).includes(file)) {
    throw new Error(`File is not in the tarball allowlist: ${file}`);
  }
}
for (const requiredFile of allowedFiles) {
  if (!files.includes(requiredFile)) {
    throw new Error(`Required public artifact is missing from tarball: ${requiredFile}`);
  }
}

const packageJson = JSON.parse(
  execFileSync("tar", ["-xOf", tarball, "package/package.json"], { encoding: "utf8" }),
) as PackageManifest;
if (packageJson.name !== "scheme-tokens") {
  throw new Error("core package name must be scheme-tokens");
}
if (packageJson.version !== "0.1.0") {
  throw new Error("core package version must be 0.1.0 for the first public release candidate");
}
if (packageJson.private !== undefined) {
  throw new Error("core package must not be private when checking the public tarball");
}
if (packageJson.publishConfig !== undefined) {
  throw new Error("unscoped core package must not carry scoped publishConfig access metadata");
}
if (
  JSON.stringify([...packageJson.files].sort()) !==
  JSON.stringify(["CHANGELOG.md", "LICENSE", "README.md", "dist", "schemas"])
) {
  throw new Error("package files must contain only the approved public artifact roots");
}
for (const [field, dependencies] of [
  ["dependencies", packageJson.dependencies],
  ["optionalDependencies", packageJson.optionalDependencies],
  ["peerDependencies", packageJson.peerDependencies],
] as const) {
  if (Object.keys(dependencies ?? {}).length > 0) {
    throw new Error(`core package tarball must not advertise ${field}`);
  }
}
if (
  packageJson.repository.type !== "git" ||
  packageJson.repository.url !== "git+https://github.com/maikeleckelboom/scheme-tokens.git" ||
  packageJson.homepage !== "https://github.com/maikeleckelboom/scheme-tokens#readme" ||
  packageJson.bugs.url !== "https://github.com/maikeleckelboom/scheme-tokens/issues"
) {
  throw new Error("package repository metadata must match maikeleckelboom/scheme-tokens");
}
if (
  JSON.stringify(Object.keys(packageJson.exports).sort()) !==
  JSON.stringify([
    ".",
    "./package.json",
    "./schemas/compiled-scheme.v1.schema.json",
    "./schemas/token-graph.v1.schema.json",
    "./schemas/token-layer.v1.schema.json",
  ])
) {
  throw new Error("packed manifest exposes an unexpected package subpath");
}
const dependencyText = JSON.stringify(packageJson);
if (
  dependencyText.includes("@texel/color") ||
  dependencyText.includes("@material/material-color-utilities") ||
  dependencyText.includes("@scheme-tokens/material3") ||
  dependencyText.includes("css-tree")
) {
  throw new Error("core package manifest leaks optional engine dependencies");
}

function runPnpm(args: readonly string[], cwd: string): string {
  const npmExecPath = process.env.npm_execpath;
  return npmExecPath === undefined
    ? execFileSync("pnpm", args, { cwd, encoding: "utf8" })
    : execFileSync(process.execPath, [npmExecPath, ...args], { cwd, encoding: "utf8" });
}
