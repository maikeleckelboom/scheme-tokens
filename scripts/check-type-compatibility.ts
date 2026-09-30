import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateNextVersion } from "./type-compatibility-version.ts";
import { supportedCompilers } from "./supported-compilers.ts";
import { packReleaseCandidate } from "../packages/material3/scripts/release-candidate.ts";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const materialRoot = join(repoRoot, "packages", "material3");
const manifest = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
  readonly devDependencies: { readonly typescript: string };
};
const repositoryVersion = manifest.devDependencies.typescript;
const role = process.argv[2];
const compilers = supportedCompilers(repositoryVersion, process.argv[3]);
if (role !== "stable" && role !== "next") {
  throw new Error("Use stable or next");
}

const temporaryRoots: string[] = [];
try {
  const candidateRoot = mkdtempSync(join(tmpdir(), "scheme-tokens-type-pair-"));
  temporaryRoots.push(candidateRoot);
  // Build once with the development compiler; every consumer compiler reads this actual pair.
  const { coreTarball, adapterTarball } = packReleaseCandidate(candidateRoot);
  const artifacts = {
    SCHEME_TOKENS_CORE_TARBALL: coreTarball,
    SCHEME_TOKENS_MATERIAL_TARBALL: adapterTarball,
  };
  if (role === "stable") {
    for (const { version, roles } of compilers) {
      const compiler =
        version === repositoryVersion ? localCompiler(repoRoot) : installCompiler(version);
      runSuite(compiler, `${roles.join(" + ")}: ${version}`, artifacts);
    }
  } else {
    const compiler = installCompiler(resolveNextVersion());
    runSuite(compiler, `non-blocking next signal: ${compilerVersion(compiler)}`, artifacts);
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

function runSuite(
  compiler: string,
  label: string,
  artifacts: Readonly<Record<string, string>>,
): void {
  process.stdout.write(`Type compatibility: ${label}\n`);
  for (const [root, configurations] of [
    [
      repoRoot,
      ["tsconfig.lib.json", "tsconfig.type-tests.json", "tsconfig.type-tests.strict.json"],
    ],
    [
      materialRoot,
      [
        "tsconfig.lib.json",
        "tsconfig.type-tests.json",
        "tsconfig.type-tests.strict.json",
        "tsconfig.type-tests.source.json",
        "tsconfig.type-tests.source.strict.json",
      ],
    ],
  ] as const) {
    for (const config of configurations) {
      run(process.execPath, [compiler, "-p", config], root);
      if (config === "tsconfig.type-tests.json" || config === "tsconfig.type-tests.source.json") {
        const emitted = mkdtempSync(join(tmpdir(), "scheme-tokens-source-types-"));
        temporaryRoots.push(emitted);
        run(
          process.execPath,
          [
            compiler,
            "-p",
            config,
            "--noEmit",
            "false",
            "--emitDeclarationOnly",
            "--rootDir",
            repoRoot,
            "--outDir",
            emitted,
          ],
          root,
        );
        const matrix = root === repoRoot ? "tests/types" : "packages/material3/tests/types";
        for (const file of readdirSync(join(repoRoot, matrix)).filter((path) =>
          path.endsWith(".ts"),
        )) {
          readFileSync(join(emitted, matrix, file.replace(/\.ts$/u, ".d.ts")));
        }
        process.stdout.write(`Source type matrix and declaration emission passed: ${root}\n`);
      }
    }
  }
  const environment = { ...process.env, ...artifacts, SCHEME_TOKENS_TSC_PATH: compiler };
  runPnpm(["smoke:consumer"], repoRoot, environment);
  runPnpm(["check:packed-types"], repoRoot, environment);
  runPnpm(["check:module-resolution"], repoRoot, environment);
  runPnpm(["check:theme-coordinate-consumer"], repoRoot, environment);
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
