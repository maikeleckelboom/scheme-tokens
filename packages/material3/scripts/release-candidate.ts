import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { packageRoot, repoRoot } from "./api-snapshot.ts";

/** Pack the pending Changesets pair without versioning the checkout. */
export function packReleaseCandidate(workspace: string): {
  readonly coreTarball: string;
  readonly adapterTarball: string;
  readonly versions: { readonly core: string; readonly adapter: string };
} {
  runPnpm(["build"], repoRoot);
  runPnpm(["build"], packageRoot);
  const candidateRoot = join(workspace, "release-candidate");
  prepareReleaseCandidate(candidateRoot);
  applyChangesetsIfPending(candidateRoot);
  const versions = assertReleaseCandidateVersions(candidateRoot);
  runPnpm(["install", "--ignore-scripts", "--strict-peer-dependencies"], candidateRoot);
  const packDirectory = join(workspace, "pack");
  mkdirSync(packDirectory, { recursive: true });
  const coreTarball = pack(candidateRoot, packDirectory);
  const adapterTarball = pack(join(candidateRoot, "packages", "material3"), packDirectory);
  process.stdout.write(
    `Candidate pair: scheme-tokens@${versions.core}, @scheme-tokens/material3@${versions.adapter}, peer ^0.4.0.\n`,
  );
  return { coreTarball, adapterTarball, versions };
}

function prepareReleaseCandidate(candidateRoot: string): void {
  mkdirSync(candidateRoot, { recursive: true });
  copyEntries(repoRoot, candidateRoot, [
    "package.json",
    "pnpm-workspace.yaml",
    "README.md",
    "CHANGELOG.md",
    "LICENSE",
    "dist",
    "schemas",
  ]);
  copyEntries(join(repoRoot, ".changeset"), join(candidateRoot, ".changeset"), [
    "config.json",
    ...readdirSync(join(repoRoot, ".changeset")).filter(
      (entry) => entry.endsWith(".md") && entry !== "README.md",
    ),
  ]);
  copyEntries(packageRoot, join(candidateRoot, "packages", "material3"), [
    "package.json",
    "README.md",
    "LICENSE",
    "LICENSE-MATERIAL-COLOR-UTILITIES",
    "THIRD_PARTY_NOTICES.md",
    "dist",
  ]);
  writeFileSync(
    join(candidateRoot, "pnpm-workspace.yaml"),
    'packages:\n  - "."\n  - "packages/material3"\n',
  );
}

function applyChangesetsIfPending(candidateRoot: string): void {
  const changesetDirectory = join(candidateRoot, ".changeset");
  const hasPendingChangesets = readdirSync(changesetDirectory).some(
    (entry) => entry.endsWith(".md") && entry !== "README.md",
  );
  if (!hasPendingChangesets) {
    process.stdout.write(
      "No pending Changesets; testing the already-versioned release candidate.\n",
    );
    return;
  }

  execFileSync(
    process.execPath,
    [join(repoRoot, "node_modules", "@changesets", "cli", "bin.js"), "version"],
    {
      cwd: candidateRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    },
  );
}

function assertReleaseCandidateVersions(candidateRoot: string): {
  readonly core: string;
  readonly adapter: string;
} {
  // Changesets transforms only this temporary workspace; committed versions stay unchanged.
  const core = readManifest(join(candidateRoot, "package.json"));
  const adapter = readManifest(join(candidateRoot, "packages", "material3", "package.json"));
  if (core.version !== "0.4.0") {
    throw new Error(`Core release candidate must be 0.4.0, received ${core.version}.`);
  }
  if (adapter.version !== "0.2.0") {
    throw new Error(
      `Changesets-projected adapter version must be 0.2.0, received ${adapter.version}.`,
    );
  }
  const corePeer = adapter.peerDependencies?.["scheme-tokens"];
  if (corePeer !== "^0.4.0") {
    throw new Error(
      `Changesets-projected adapter must advertise ^0.4.0, received ${corePeer ?? "<missing>"}.`,
    );
  }
  return { core: core.version, adapter: adapter.version };
}

interface PackageManifest {
  readonly version: string;
  readonly peerDependencies?: Readonly<Record<string, string>>;
}

function readManifest(path: string): PackageManifest {
  return JSON.parse(readFileSync(path, "utf8")) as PackageManifest;
}

function copyEntries(fromRoot: string, toRoot: string, entries: readonly string[]): void {
  mkdirSync(toRoot, { recursive: true });
  for (const entry of entries) {
    const source = join(fromRoot, entry);
    const destination = join(toRoot, entry);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(source, destination, { recursive: true });
  }
}

function pack(cwd: string, destination: string): string {
  const output = runPnpm(
    ["pack", "--config.ignore-scripts=true", "--pack-destination", destination],
    cwd,
    { ...process.env, npm_config_ignore_scripts: "true" },
  )
    .trim()
    .split(/\r?\n/u)
    .at(-1);
  if (output === undefined) {
    throw new Error(`Unable to determine packed tarball from ${cwd}`);
  }
  return join(destination, basename(output));
}

function runPnpm(
  args: readonly string[],
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const npmExecPath = process.env.npm_execpath;
  return npmExecPath === undefined
    ? run("pnpm", args, cwd, env)
    : run(process.execPath, [npmExecPath, ...args], cwd, env);
}

function run(
  command: string,
  args: readonly string[],
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return execFileSync(command, args, {
    cwd,
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
}
