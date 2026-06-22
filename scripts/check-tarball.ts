import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

interface PackageManifest {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly files: readonly string[];
  readonly private?: boolean;
  readonly publishConfig?: unknown;
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
const requiredSchemaFiles = new Set([
  "package/schemas/compiled-scheme.v1.schema.json",
  "package/schemas/token-graph.v1.schema.json",
  "package/schemas/token-layer.v1.schema.json",
]);

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
  if (
    !(
      file === "package/package.json" ||
      file === "package/README.md" ||
      file === "package/CHANGELOG.md" ||
      file === "package/LICENSE" ||
      file.startsWith("package/dist/") ||
      requiredSchemaFiles.has(file)
    )
  ) {
    throw new Error(`File is not in the tarball allowlist: ${file}`);
  }
}
for (const schemaFile of requiredSchemaFiles) {
  if (!files.includes(schemaFile)) {
    throw new Error(`Required schema is missing from tarball: ${schemaFile}`);
  }
}

const packageJson = JSON.parse(
  readFileSync(join(repoRoot, "package.json"), "utf8"),
) as PackageManifest;
if (packageJson.version !== "0.1.0") {
  throw new Error("core package version must be 0.1.0 for the first public release candidate");
}
if (packageJson.private !== undefined) {
  throw new Error("core package must not be private when checking the public tarball");
}
if (packageJson.publishConfig !== undefined) {
  throw new Error("unscoped core package must not carry scoped publishConfig access metadata");
}
if (packageJson.files.includes("docs")) {
  throw new Error("package files must not include docs");
}
if ("dependencies" in packageJson && Object.keys(packageJson.dependencies).length > 0) {
  throw new Error("core package tarball must not advertise runtime dependencies");
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
