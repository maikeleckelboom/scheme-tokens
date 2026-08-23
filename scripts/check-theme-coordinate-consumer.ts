import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

interface PackageManifest {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly exports: Readonly<Record<string, unknown>>;
  readonly name: string;
  readonly optionalDependencies?: Readonly<Record<string, string>>;
  readonly peerDependencies?: Readonly<Record<string, string>>;
  readonly version: string;
}

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const exampleSource = join(repoRoot, "examples", "theme-coordinates", "theme.ts");
const manifest = JSON.parse(
  readFileSync(join(repoRoot, "package.json"), "utf8"),
) as PackageManifest;
const workspace = mkdtempSync(join(tmpdir(), "scheme-tokens-theme-coordinate-"));
const packDirectory = join(workspace, "pack");
const consumerDirectory = join(workspace, "consumer");
const consumerSource = join(consumerDirectory, "theme.ts");
mkdirSync(packDirectory, { recursive: true });
mkdirSync(consumerDirectory, { recursive: true });

const tarball = pack(packDirectory);
writeJson(join(consumerDirectory, "package.json"), {
  private: true,
  type: "module",
  dependencies: {
    [manifest.name]: fileDependencySpec(consumerDirectory, tarball),
  },
});
writeJson(join(consumerDirectory, "tsconfig.json"), {
  compilerOptions: {
    strict: true,
    skipLibCheck: false,
    module: "NodeNext",
    moduleResolution: "NodeNext",
    target: "ES2022",
    lib: ["ES2022"],
    types: [],
    resolveJsonModule: true,
    verbatimModuleSyntax: true,
    rootDir: ".",
    outDir: "dist",
  },
  include: ["theme.ts"],
});

copyFileSync(exampleSource, consumerSource);
assertEqual(
  readFileSync(consumerSource, "utf8"),
  readFileSync(exampleSource, "utf8"),
  "checked-in example copy",
);

runPnpm(["install", "--ignore-scripts"], consumerDirectory);
run(
  process.execPath,
  [join(repoRoot, "node_modules", "typescript", "bin", "tsc"), "-p", "tsconfig.json"],
  consumerDirectory,
);
run(process.execPath, [join("dist", "theme.js")], consumerDirectory);

const installedManifest = JSON.parse(
  readFileSync(join(consumerDirectory, "node_modules", manifest.name, "package.json"), "utf8"),
) as PackageManifest;
assertEqual(installedManifest.name, "scheme-tokens", "installed package name");
// The consumer installs this repository's tarball, so the version it resolves
// has to track the manifest rather than a value that goes stale on release.
assertEqual(installedManifest.version, manifest.version, "installed package version");
assertDeepEqual(
  Object.keys(installedManifest.exports).sort(),
  [
    ".",
    "./package.json",
    "./schemas/compiled-scheme.v1.schema.json",
    "./schemas/token-graph.v1.schema.json",
    "./schemas/token-layer.v1.schema.json",
  ],
  "installed package exports",
);
for (const dependencyField of [
  installedManifest.dependencies,
  installedManifest.optionalDependencies,
  installedManifest.peerDependencies,
]) {
  if (Object.keys(dependencyField ?? {}).length > 0) {
    throw new Error("theme-coordinate consumer installed a package with runtime dependencies");
  }
}

process.stdout.write(
  `${JSON.stringify(
    {
      workspace,
      consumerDirectory,
      exampleSource,
      tarball,
      lifecycleScripts: "disabled during consumer install",
      modes: 4,
      selectedRoles: 11,
    },
    null,
    2,
  )}\n`,
);

function pack(destination: string): string {
  const output = runPnpm(["pack", "--pack-destination", destination], repoRoot)
    .trim()
    .split(/\r?\n/)
    .at(-1);
  if (output === undefined) {
    throw new Error("Unable to determine packed tarball name");
  }
  return join(destination, basename(output));
}

function fileDependencySpec(fromDirectory: string, tarballPath: string): string {
  return `file:${relative(fromDirectory, tarballPath).replaceAll("\\", "/")}`;
}

function runPnpm(args: readonly string[], cwd: string): string {
  const npmExecPath = process.env.npm_execpath;
  return npmExecPath === undefined
    ? run("pnpm", args, cwd)
    : run(process.execPath, [npmExecPath, ...args], cwd);
}

function run(command: string, args: readonly string[], cwd: string): string {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function assertEqual(actual: string, expected: string, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label} mismatch\nactual: ${actual}\nexpected: ${expected}`);
  }
}

function assertDeepEqual(actual: unknown, expected: unknown, label: string): void {
  assertEqual(JSON.stringify(actual), JSON.stringify(expected), label);
}
