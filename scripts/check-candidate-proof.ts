import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { repoRoot } from "./api-snapshot.ts";
import { checkConsumerCandidate } from "./check-consumer-candidate.ts";
import { sha256 } from "./consumer-candidate-source.ts";

const workspace = mkdtempSync(join(tmpdir(), "scheme-tokens-candidate-proof-"));
try {
  const candidate = join(workspace, "candidate");
  runPnpm(["candidate:pack", candidate], repoRoot, true);
  const provenance = JSON.parse(readFileSync(join(candidate, "provenance.json"), "utf8")) as {
    readonly sourceCommit: string;
    readonly sourceDiffSha256: string;
    readonly artifacts: readonly { readonly filename: string; readonly sha256: string }[];
    readonly versions: { readonly core: string; readonly adapter: string };
  };
  assert.deepEqual(provenance.versions, { core: "0.4.0", adapter: "0.2.0" });
  const patch = readFileSync(join(candidate, "source.patch"));
  assert.equal(sha256(patch), provenance.sourceDiffSha256);
  const reconstructed = join(workspace, "reconstructed");
  run(
    "git",
    ["clone", "--quiet", "--no-hardlinks", "--no-checkout", repoRoot, reconstructed],
    workspace,
  );
  run("git", ["checkout", "--quiet", "--detach", provenance.sourceCommit], reconstructed);
  if (patch.length > 0) {
    run("git", ["apply", "--check", join(candidate, "source.patch")], reconstructed);
    run(
      "git",
      ["apply", "--index", "--whitespace=nowarn", join(candidate, "source.patch")],
      reconstructed,
    );
  }
  assert.deepEqual(
    execFileSync("git", ["diff", "HEAD", "--binary", "--no-ext-diff", "--no-textconv"], {
      cwd: reconstructed,
    }),
    patch,
  );
  process.stdout.write("Candidate patch hash and Git reconstruction passed.\n");

  const resolved = join(workspace, "resolved-consumer");
  const vendor = join(resolved, "vendor", "scheme-tokens");
  mkdirSync(vendor, { recursive: true });
  for (const artifact of provenance.artifacts) {
    const source = join(candidate, "pack", artifact.filename);
    assert.equal(sha256(readFileSync(source)), artifact.sha256);
    process.stdout.write(
      `Candidate artifact verified: ${artifact.filename}, SHA-256 ${artifact.sha256}\n`,
    );
    copyFileSync(source, join(vendor, artifact.filename));
  }
  copyFileSync(join(candidate, "provenance.json"), join(vendor, "provenance.json"));
  writeFileSync(
    join(resolved, "package.json"),
    JSON.stringify({
      private: true,
      type: "module",
      dependencies: {
        "scheme-tokens": "file:vendor/scheme-tokens/scheme-tokens-0.4.0.tgz",
        "@scheme-tokens/material3": "file:vendor/scheme-tokens/scheme-tokens-material3-0.2.0.tgz",
      },
    }),
  );
  runPnpm(
    ["install", "--lockfile-only", "--ignore-scripts", "--strict-peer-dependencies"],
    resolved,
  );
  // Copy only portable installation inputs into a second directory with no installed files.
  const consumer = join(workspace, "frozen-consumer");
  cpSync(resolved, consumer, { recursive: true });
  assert(
    !existsSync(join(consumer, "node_modules")),
    "Frozen proof starts without installed files",
  );
  runPnpm(
    [
      "install",
      "--frozen-lockfile",
      "--ignore-scripts",
      "--strict-peer-dependencies",
      "--store-dir",
      join(workspace, "fresh-store"),
    ],
    consumer,
  );
  checkConsumerCandidate(consumer);
  for (const [example, destination] of [
    ["theme.ts", "theme.ts"],
    ["material.ts", "material.ts"],
  ] as const) {
    copyFileSync(
      join(repoRoot, "examples", "theme-coordinates", example),
      join(consumer, destination),
    );
  }
  writeFileSync(
    join(consumer, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        skipLibCheck: false,
        exactOptionalPropertyTypes: true,
        noUncheckedIndexedAccess: true,
        verbatimModuleSyntax: true,
        declaration: true,
        target: "ES2022",
        lib: ["ES2022"],
        types: [],
        module: "NodeNext",
        moduleResolution: "NodeNext",
        outDir: "dist",
        rootDir: ".",
      },
      include: ["theme.ts", "material.ts"],
    }),
  );
  run(
    process.execPath,
    [join(repoRoot, "node_modules", "typescript", "bin", "tsc"), "-p", "tsconfig.json"],
    consumer,
  );
  for (const example of ["theme", "material"]) {
    readFileSync(join(consumer, "dist", `${example}.d.ts`));
    run(process.execPath, [join("dist", `${example}.js`)], consumer);
  }
  process.stdout.write(
    "Candidate portable lockfile, fresh frozen strict-peer installation, shared core, and authoritative coordinate runtimes passed.\n",
  );
} finally {
  rmSync(workspace, { recursive: true, force: true });
}

function runPnpm(args: readonly string[], cwd: string, quiet = false): void {
  const npmExecPath = process.env.npm_execpath;
  execFileSync(
    npmExecPath === undefined ? "pnpm" : process.execPath,
    npmExecPath === undefined ? args : [npmExecPath, ...args],
    { cwd, stdio: quiet ? ["ignore", "pipe", "inherit"] : "inherit" },
  );
}

function run(command: string, args: readonly string[], cwd: string): void {
  execFileSync(command, args, { cwd, stdio: "inherit" });
}
