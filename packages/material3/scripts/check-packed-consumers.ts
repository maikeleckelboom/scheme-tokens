import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, parse, relative, resolve } from "node:path";
import { packageRoot, repoRoot } from "./api-snapshot.ts";

const workspace = mkdtempSync(join(tmpdir(), "scheme-tokens-material3-consumers-"));
assertSafeTemporaryRoot(workspace);

try {
  runPnpm(["build"], repoRoot);
  runPnpm(["build"], packageRoot);

  const candidateRoot = join(workspace, "release-candidate");
  prepareReleaseCandidate(candidateRoot);
  applyChangesets(candidateRoot);
  const versions = assertReleaseCandidateVersions(candidateRoot);
  runPnpm(["install", "--ignore-scripts", "--strict-peer-dependencies"], candidateRoot);

  const packDirectory = join(workspace, "pack");
  mkdirSync(packDirectory, { recursive: true });
  const coreTarball = pack(candidateRoot, packDirectory);
  const adapterTarball = pack(join(candidateRoot, "packages", "material3"), packDirectory);

  checkCombinedConsumer(coreTarball, adapterTarball);
  checkCoreOnlyConsumer(coreTarball);
  process.stdout.write(
    `Packed release-candidate consumers passed for scheme-tokens@${versions.core} and @scheme-tokens/material3@${versions.adapter}.\n`,
  );
} finally {
  rmSync(workspace, { recursive: true, force: true });
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

function applyChangesets(candidateRoot: string): void {
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
  const core = readManifest(join(candidateRoot, "package.json"));
  const adapter = readManifest(join(candidateRoot, "packages", "material3", "package.json"));
  if (core.version !== "0.1.1") {
    throw new Error(`Pending core changesets must produce 0.1.1, received ${core.version}.`);
  }
  if (adapter.version !== "0.1.0") {
    throw new Error(`Initial adapter changeset must produce 0.1.0, received ${adapter.version}.`);
  }
  if (adapter.peerDependencies?.["scheme-tokens"] !== "^0.1.1") {
    throw new Error(
      "Release-candidate adapter does not require the first compatible core release.",
    );
  }
  return { core: core.version, adapter: adapter.version };
}

function checkCombinedConsumer(coreTarball: string, adapterTarball: string): void {
  const consumer = join(workspace, "combined-consumer");
  mkdirSync(consumer, { recursive: true });
  writeJson(join(consumer, "package.json"), {
    private: true,
    type: "module",
    dependencies: {
      "scheme-tokens": fileDependencySpec(consumer, coreTarball),
      "@scheme-tokens/material3": fileDependencySpec(consumer, adapterTarball),
    },
  });
  writeJson(join(consumer, "tsconfig.json"), {
    compilerOptions: {
      strict: true,
      module: "NodeNext",
      moduleResolution: "NodeNext",
      target: "ES2022",
      lib: ["ES2022"],
      types: [],
      exactOptionalPropertyTypes: true,
      noUncheckedIndexedAccess: true,
      verbatimModuleSyntax: true,
      skipLibCheck: false,
      rootDir: ".",
      outDir: "dist",
    },
    include: ["consumer.ts"],
  });
  writeFileSync(join(consumer, "consumer.ts"), combinedConsumerSource());
  writeFileSync(join(consumer, "consumer.mjs"), rawNodeConsumerSource());

  runPnpm(["install", "--ignore-scripts", "--strict-peer-dependencies"], consumer);
  run(process.execPath, ["consumer.mjs"], consumer);
  run(
    process.execPath,
    [join(repoRoot, "node_modules", "typescript", "bin", "tsc"), "-p", "tsconfig.json"],
    consumer,
  );
  run(process.execPath, [join("dist", "consumer.js")], consumer);

  if (existsSync(join(consumer, "node_modules", "@material", "material-color-utilities"))) {
    throw new Error("Packed adapter consumer installed Material Color Utilities separately.");
  }
}

function checkCoreOnlyConsumer(coreTarball: string): void {
  const consumer = join(workspace, "core-only-consumer");
  mkdirSync(consumer, { recursive: true });
  writeJson(join(consumer, "package.json"), {
    private: true,
    type: "module",
    dependencies: { "scheme-tokens": fileDependencySpec(consumer, coreTarball) },
  });
  writeFileSync(
    join(consumer, "consumer.mjs"),
    `import { compileTokenGraph, defineTokens } from "scheme-tokens";\n\n` +
      `const compiled = compileTokenGraph(defineTokens({ primary: "#6750a4" }), { selection: "all" });\n` +
      `if (!compiled.ok || compiled.value.tokens.primary.base !== "#6750a4") throw new Error("core-only consumer failed");\n`,
  );
  runPnpm(["install", "--ignore-scripts", "--strict-peer-dependencies"], consumer);
  run(process.execPath, ["consumer.mjs"], consumer);
  if (
    existsSync(join(consumer, "node_modules", "@scheme-tokens", "material3")) ||
    existsSync(join(consumer, "node_modules", "@material", "material-color-utilities"))
  ) {
    throw new Error("Packed core-only consumer installed optional Material packages.");
  }
}

function rawNodeConsumerSource(): string {
  return `
import {
  compileTokenGraph,
  defineTokenGraph,
  exportCssVars,
  tokenRef,
} from "scheme-tokens";
import { material3 } from "@scheme-tokens/material3";

const material = material3("#6750a4");
const graph = defineTokenGraph({
  ...material,
  tokens: { "action.primary.background": tokenRef("md.sys.color.primary") },
});
const compiled = compileTokenGraph(graph, { selection: "all" });
if (!compiled.ok) throw new Error(JSON.stringify(compiled.issues));
if (compiled.value.tokens["md.sys.color.primary"].light !== "#65558f") {
  throw new Error("raw Node ESM Material generation failed");
}
if (compiled.value.tokens["action.primary.background"].dark !== "#cfbdfe") {
  throw new Error("raw Node ESM composition failed");
}
const css = exportCssVars(compiled.value, {
  variableName: ({ segments }) => \`--\${segments.join("-")}\`,
});
if (!css.ok || css.value.variableByToken["md.sys.color.primary"] !== "--md-sys-color-primary") {
  throw new Error("raw Node ESM Material CSS naming failed");
}
`;
}

function combinedConsumerSource(): string {
  return `
import { material3, type Material3GraphFragment, type Material3TokenKey } from "@scheme-tokens/material3";
import {
  compileTokenGraph,
  defineTokenGraph,
  defineTokenLayer,
  exportCssVars,
  tokenRef,
  type TokenLayer,
} from "scheme-tokens";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2) ? true : false;
type Expect<Value extends true> = Value;
type ModeOf<Value> = Value extends Material3GraphFragment<infer Mode> ? Mode : never;

const material = material3("#6750a4", {
  modes: { "light-high": { appearance: "light", contrastLevel: 1 } },
  defaultMode: "light-high",
});
type ModeProof = Expect<Equal<ModeOf<typeof material>, "light" | "dark" | "light-high">>;
type LayerProof = Expect<Equal<(typeof material.layers)[0], TokenLayer<Material3TokenKey, string>>>;
const modeProof: ModeProof = true;
const layerProof: LayerProof = true;
void modeProof;
void layerProof;

// @ts-expect-error packed declarations retain the exact Material token-key union.
const invalidKey: Material3TokenKey = "md.sys.color.primari";
void invalidKey;
if (false) {
  // @ts-expect-error packed declarations require appearance for custom modes.
  material3("#6750a4", { modes: { "light-high": { contrastLevel: 1 } } });
}

const overrides = defineTokenLayer({
  id: "brand-overrides",
  tokens: { "md.sys.color.primary": "#ff0055" },
});
const graph = defineTokenGraph({
  ...material,
  layers: [...material.layers, overrides],
  tokens: {
    "action.primary.background": tokenRef("md.sys.color.primary"),
    "brand.seed": "#6750a4",
  },
});
const compiled = compileTokenGraph(graph, { selection: "all" });
if (!compiled.ok) throw new Error(JSON.stringify(compiled.issues));
type KeyProof = Expect<Equal<
  keyof typeof compiled.value.tokens,
  Material3TokenKey | "action.primary.background" | "brand.seed"
>>;
const keyProof: KeyProof = true;
void keyProof;
if (compiled.value.tokens["md.sys.color.primary"].light !== "#ff0055") {
  throw new Error("packed override failed");
}
if (compiled.value.metadataByToken["md.sys.color.primary"].origin.kind !== "layer") {
  throw new Error("packed provenance failed");
}
const css = exportCssVars(compiled.value, {
  variableName: ({ segments }) => \`--\${segments.join("-")}\`,
});
if (!css.ok || css.value.variableByToken["md.sys.color.primary"] !== "--md-sys-color-primary") {
  throw new Error("packed Material CSS naming failed");
}
`;
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

function fileDependencySpec(fromDirectory: string, tarballPath: string): string {
  return `file:${relative(fromDirectory, tarballPath).replaceAll("\\", "/")}`;
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

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function assertSafeTemporaryRoot(path: string): void {
  const resolved = resolve(path);
  const systemTemp = resolve(tmpdir());
  if (
    dirname(resolved) !== systemTemp ||
    !parse(resolved).base.startsWith("scheme-tokens-material3-consumers-")
  ) {
    throw new Error(`Refusing to use unexpected temporary directory: ${resolved}`);
  }
}
