import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateNextVersion } from "./type-compatibility-version.ts";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const materialRoot = join(repoRoot, "packages", "material3");
const manifest = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
  readonly devDependencies: { readonly typescript: string };
};
const repositoryVersion = manifest.devDependencies.typescript;
const floorVersion = "7.0.2";
const role = process.argv[2];

if (!/^7\.\d+\.\d+$/u.test(repositoryVersion) || !/^7\.0\.\d+$/u.test(floorVersion)) {
  throw new Error("The blocking TypeScript versions must be exact stable 7.x releases");
}
if (role !== "stable" && role !== "next") {
  throw new Error("Use stable or next");
}

const temporaryRoots: string[] = [];
try {
  if (role === "stable") {
    const versions = new Map<string, string[]>();
    for (const [label, version] of [
      ["7.0 floor", floorVersion],
      ["repository stable", repositoryVersion],
    ] as const) {
      versions.set(version, [...(versions.get(version) ?? []), label]);
    }
    for (const [version, labels] of versions) {
      const compiler =
        version === repositoryVersion ? localCompiler(repoRoot) : installCompiler(version);
      runSuite(compiler, `${labels.join(" + ")}: ${version}`);
    }
  } else {
    const compiler = installCompiler(resolveNextVersion());
    runSuite(compiler, `non-blocking next signal: ${compilerVersion(compiler)}`);
  }
} finally {
  for (const root of temporaryRoots) {
    rmSync(root, { recursive: true, force: true });
  }
}

function resolveNextVersion(): string {
  const npmExecPath = process.env.npm_execpath;
  const command = npmExecPath === undefined ? "pnpm" : process.execPath;
  const args = ["view", "typescript@next", "version"];
  const output = execFileSync(command, npmExecPath === undefined ? args : [npmExecPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();
  return validateNextVersion(output);
}

function localCompiler(root: string): string {
  return join(root, "node_modules", "typescript", "bin", "tsc");
}

function installCompiler(version: string): string {
  const root = mkdtempSync(join(tmpdir(), "scheme-tokens-type-compat-"));
  temporaryRoots.push(root);
  writeFileSync(join(root, "package.json"), '{"private":true,"name":"type-compat"}\n');
  runPnpm(["add", "-D", "-E", `typescript@${version}`], root);
  return localCompiler(root);
}

function compilerVersion(compiler: string): string {
  return execFileSync(process.execPath, [compiler, "--version"], {
    encoding: "utf8",
  }).trim();
}

function runSuite(compiler: string, label: string): void {
  process.stdout.write(`Type compatibility: ${label}\n`);
  for (const [root, configurations] of [
    [repoRoot, ["tsconfig.lib.json", "tsconfig.type-tests.json"]],
    [materialRoot, ["tsconfig.lib.json", "tsconfig.type-tests.json"]],
  ] as const) {
    for (const config of configurations) {
      run(process.execPath, [compiler, "-p", config], root);
    }
  }
  const environment = { ...process.env, SCHEME_TOKENS_TSC_PATH: compiler };
  runPnpm(["smoke:consumer"], repoRoot, environment);
  runPnpm(
    ["--filter", "@scheme-tokens/material3", "check:packed-consumers"],
    repoRoot,
    environment,
  );
  process.stdout.write(`Type compatibility passed: ${label}\n`);
}

function runPnpm(args: readonly string[], root: string, env = process.env): void {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath === undefined) {
    run("pnpm", args, root, env);
  } else {
    run(process.execPath, [npmExecPath, ...args], root, env);
  }
}

function run(command: string, args: readonly string[], cwd: string, env = process.env): void {
  execFileSync(command, args, { cwd, env, stdio: "inherit" });
}
