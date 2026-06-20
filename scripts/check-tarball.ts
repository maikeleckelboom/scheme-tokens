import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

interface PackageManifest {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly files: readonly string[];
}

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const workspace = mkdtempSync(join(tmpdir(), "color-scheme-tokens-tarball-"));
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

const packageJson = JSON.parse(
  readFileSync(join(repoRoot, "package.json"), "utf8"),
) as PackageManifest;
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
