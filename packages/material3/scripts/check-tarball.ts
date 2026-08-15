import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, parse, resolve } from "node:path";
import { packageRoot } from "./api-snapshot.ts";

const workspace = mkdtempSync(join(tmpdir(), "scheme-tokens-material3-tarball-"));
assertSafeTemporaryRoot(workspace);
const packDirectory = join(workspace, "pack");

try {
  mkdirSync(packDirectory, { recursive: true });
  const output = runPnpm(["pack", "--pack-destination", packDirectory])
    .trim()
    .split(/\r?\n/u)
    .at(-1);
  if (output === undefined) {
    throw new Error("Unable to determine adapter tarball name");
  }
  const tarballName = basename(output);
  const files = tar(["-tf", tarballName]).trim().split(/\r?\n/u);
  const allowedFiles = [
    "package/LICENSE",
    "package/LICENSE-MATERIAL-COLOR-UTILITIES",
    "package/README.md",
    "package/THIRD_PARTY_NOTICES.md",
    "package/dist/index.d.ts",
    "package/dist/index.js",
    "package/dist/index.js.map",
    "package/package.json",
  ] as const;

  assertEqual(files, allowedFiles, "adapter tarball files");
  const manifest = JSON.parse(
    tar(["-xOf", tarballName, "package/package.json"]),
  ) as PackageManifest;
  const repositoryManifest = JSON.parse(
    readFileSync(join(packageRoot, "package.json"), "utf8"),
  ) as PackageManifest;
  if (
    manifest.name !== "@scheme-tokens/material3" ||
    manifest.version !== repositoryManifest.version
  ) {
    throw new Error("Packed adapter identity does not match its workspace manifest");
  }
  if (manifest.private !== undefined || manifest.publishConfig?.access !== "public") {
    throw new Error("Packed adapter is not configured as a publishable public scoped package");
  }
  if (
    manifest.type !== "module" ||
    manifest.sideEffects !== false ||
    manifest.engines.node !== ">=24" ||
    manifest.license !== "MIT AND Apache-2.0"
  ) {
    throw new Error("Packed adapter runtime or licensing metadata drifted");
  }
  assertEqual(Object.keys(manifest.exports), [".", "./package.json"], "packed exports");
  assertEqual(
    manifest.files,
    ["dist", "README.md", "LICENSE", "LICENSE-MATERIAL-COLOR-UTILITIES", "THIRD_PARTY_NOTICES.md"],
    "packed files metadata",
  );
  if (
    Object.keys(manifest.dependencies ?? {}).length > 0 ||
    Object.keys(manifest.optionalDependencies ?? {}).length > 0
  ) {
    throw new Error("Packed adapter must have no runtime or optional dependencies");
  }
  if (manifest.peerDependencies["scheme-tokens"] !== "^0.2.0") {
    throw new Error("Packed adapter advertises an incorrect scheme-tokens peer range");
  }

  const bundle = tar(["-xOf", tarballName, "package/dist/index.js"]);
  if (/(?:from\s+|import\s*\()["']@material\/material-color-utilities(?:["'/])/u.test(bundle)) {
    throw new Error("Packed adapter retains an unresolved Material Color Utilities import");
  }
  if (!/from\s+["']scheme-tokens["']/u.test(bundle)) {
    throw new Error("Packed adapter did not externalize scheme-tokens");
  }
  if (!bundle.includes("//# sourceMappingURL=index.js.map")) {
    throw new Error("Packed adapter JavaScript does not reference its shipped source map");
  }
  const sourceMap = JSON.parse(tar(["-xOf", tarballName, "package/dist/index.js.map"])) as {
    readonly sources: readonly string[];
    readonly sourcesContent?: readonly (string | null)[];
  };
  if (
    sourceMap.sourcesContent === undefined ||
    sourceMap.sourcesContent.length !== sourceMap.sources.length ||
    sourceMap.sourcesContent.some((source) => source === null)
  ) {
    throw new Error("Packed adapter source map does not carry resolvable embedded sources");
  }
  if (sourceMap.sources.some((source) => /^[A-Za-z]:[\\/]/u.test(source))) {
    throw new Error("Packed adapter source map leaks an absolute Windows source path");
  }
  for (const requiredText of [
    "Material Color Utilities version 0.4.0",
    "material-foundation/material-color-utilities",
  ]) {
    if (!tar(["-xOf", tarballName, "package/THIRD_PARTY_NOTICES.md"]).includes(requiredText)) {
      throw new Error(`Packed third-party notice is missing: ${requiredText}`);
    }
  }
  if (
    !tar(["-xOf", tarballName, "package/LICENSE-MATERIAL-COLOR-UTILITIES"]).includes(
      "Apache License",
    )
  ) {
    throw new Error("Packed adapter is missing the Apache-2.0 license text");
  }
} finally {
  rmSync(workspace, { recursive: true, force: true });
}

interface PackageManifest {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly engines: { readonly node: string };
  readonly exports: Readonly<Record<string, unknown>>;
  readonly files: readonly string[];
  readonly license: string;
  readonly name: string;
  readonly optionalDependencies?: Readonly<Record<string, string>>;
  readonly peerDependencies: Readonly<Record<string, string>>;
  readonly private?: boolean;
  readonly publishConfig?: { readonly access?: string };
  readonly sideEffects: boolean;
  readonly type: string;
  readonly version: string;
}

function tar(args: readonly string[]): string {
  return execFileSync("tar", args, { cwd: packDirectory, encoding: "utf8" });
}

function runPnpm(args: readonly string[]): string {
  const npmExecPath = process.env.npm_execpath;
  return npmExecPath === undefined
    ? execFileSync("pnpm", args, { cwd: packageRoot, encoding: "utf8" })
    : execFileSync(process.execPath, [npmExecPath, ...args], {
        cwd: packageRoot,
        encoding: "utf8",
      });
}

function assertEqual(
  actualInput: readonly string[],
  expectedInput: readonly string[],
  label: string,
): void {
  const actual = [...actualInput].sort();
  const expected = [...expectedInput].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${label} mismatch\nactual: ${actual.join(", ")}\nexpected: ${expected.join(", ")}`,
    );
  }
}

function assertSafeTemporaryRoot(path: string): void {
  const resolved = resolve(path);
  const systemTemp = resolve(tmpdir());
  if (
    dirname(resolved) !== systemTemp ||
    !parse(resolved).base.startsWith("scheme-tokens-material3-tarball-")
  ) {
    throw new Error(`Refusing to use unexpected temporary directory: ${resolved}`);
  }
}
