import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// The static contract is proved on the emitted declarations, not only on workspace source:
// the source type matrix runs unchanged against the packed tarball under the strict-only and
// the stricter consumer configuration, then a small diagnostic-quality matrix checks that
// rejections name the useful context. Fragments are asserted, never whole compiler messages.

interface PackageManifest {
  readonly name: string;
}

interface DiagnosticCase {
  readonly name: string;
  readonly source: string;
  readonly expect: (output: string) => readonly string[];
}

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(
  readFileSync(join(repoRoot, "package.json"), "utf8"),
) as PackageManifest;
const compiler =
  process.env.SCHEME_TOKENS_TSC_PATH ?? join(repoRoot, "node_modules", "typescript", "bin", "tsc");
const typeTestsDirectory = join(repoRoot, "tests", "types");

const workspace = mkdtempSync(join(tmpdir(), "scheme-tokens-packed-types-"));
const packDirectory = join(workspace, "pack");
const consumerDirectory = join(workspace, "consumer");
const matrixDirectory = join(consumerDirectory, "matrix");
const diagnosticsDirectory = join(consumerDirectory, "diagnostics");
for (const directory of [packDirectory, matrixDirectory, diagnosticsDirectory]) {
  mkdirSync(directory, { recursive: true });
}

const tarball = process.env.SCHEME_TOKENS_CORE_TARBALL ?? pack(packDirectory);
writeJson(join(consumerDirectory, "package.json"), {
  private: true,
  type: "module",
  dependencies: { [manifest.name]: fileDependencySpec(consumerDirectory, tarball) },
});
const strictOptions = {
  strict: true,
  skipLibCheck: false,
  module: "NodeNext",
  moduleResolution: "NodeNext",
  target: "ES2022",
  lib: ["ES2022"],
  types: [],
  noEmit: true,
};
// `declaration` also proves that helper results stay nameable in a consumer's declarations.
const stricterOptions = {
  ...strictOptions,
  exactOptionalPropertyTypes: true,
  noUncheckedIndexedAccess: true,
  verbatimModuleSyntax: true,
  declaration: true,
  isolatedModules: true,
  noEmit: false,
  emitDeclarationOnly: true,
  outDir: "type-declarations",
  rootDir: ".",
};
writeJson(join(consumerDirectory, "tsconfig.strict.json"), {
  compilerOptions: strictOptions,
  include: ["matrix/*.ts"],
});
writeJson(join(consumerDirectory, "tsconfig.stricter.json"), {
  compilerOptions: stricterOptions,
  include: ["matrix/*.ts"],
});
writeJson(join(consumerDirectory, "tsconfig.diagnostics.json"), {
  compilerOptions: stricterOptions,
  include: ["diagnostics/*.ts"],
});

const matrixFiles = readdirSync(typeTestsDirectory).filter((file) => file.endsWith(".ts"));
if (matrixFiles.length === 0) {
  throw new Error("The source type matrix is empty");
}
for (const file of matrixFiles) {
  copyFileSync(join(typeTestsDirectory, file), join(matrixDirectory, file));
}

const diagnosticCases: readonly DiagnosticCase[] = [
  {
    name: "E1 graph reference typo",
    source: `defineTokenGraph({ tokens: { "brand.600": "#6750a4", primary: tokenRef("brand.60") } });`,
    expect: (output) => suggestion(output, "brand.600"),
  },
  {
    name: "E2 layer reference typo",
    source: `const brand = defineTokenLayer({ id: "brand", tokens: { "brand.600": "#6750a4" } });
defineTokenGraph({ layers: [brand], tokens: { primary: tokenRef("brand.60") } });`,
    expect: (output) => suggestion(output, "brand.600"),
  },
  {
    name: "E6 expanded mode-map reference typo",
    source: `defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  tokens: {
    "brand.600": "#6750a4",
    primary: { value: { light: tokenRef("brand.60"), dark: tokenRef("brand.600") } },
  },
});`,
    expect: (output) => suggestion(output, "brand.600"),
  },
  {
    name: "E7 concat reference typo",
    source:
      'defineTokenGraph({ tokens: { "brand.600": "#6750a4", ring: tokenConcat`0 0 0 3px ${tokenRef("brand.60")}` } });',
    expect: (output) => suggestion(output, "brand.600"),
  },
  {
    name: "E8 unknown token property marker",
    source: `defineTokenGraph({ tokens: { background: { value: "#fff", descripton: "Canvas" } } });`,
    expect: (output) => contains(output, 'UnknownTokenProperty<"descripton">'),
  },
  {
    name: "E4 unknown mode marker",
    source: `defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  tokens: { background: { light: "#fff", dark: "#000", dim: "#333" } },
});`,
    expect: (output) => contains(output, 'UnknownMode<"dim">'),
  },
  {
    name: "E10 unknown mode marker in value",
    source: `defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  tokens: { background: { value: { light: "#fff", dark: "#000", dim: "#333" } } },
});`,
    expect: (output) => contains(output, 'UnknownMode<"dim">'),
  },
  {
    name: "invalid mode name marker",
    source: `defineTokenGraph({ modes: ["valueByMode"], defaultMode: "valueByMode", tokens: {} });`,
    expect: (output) => contains(output, 'InvalidModeName<"valueByMode">'),
  },
  {
    name: "layer mode mismatch names both sets",
    source: `const layer = defineTokenLayer({ id: "pair", tokens: { a: { light: "#fff", dark: "#000" } } });
defineTokenGraph({ modes: ["light", "dark", "dim"], defaultMode: "light", layers: [layer], tokens: {} });`,
    expect: (output) => mismatch(output, ["dark", "light"], ["dark", "dim", "light"]),
  },
  {
    name: "raw finite graph claim names the missing proof",
    source: `export const graph: TokenGraph<"real" | "ghost", "base", "real" | "ghost"> = {
  kind: "scheme-tokens/token-graph",
  formatVersion: 2,
  modes: ["base"],
  defaultMode: "base",
  defaultVisibility: "public",
  tokens: { real: { value: "hello" } },
};`,
    expect: (output) => contains(output, "StaticProof"),
  },
  {
    name: "raw layer visibility claim names the missing proof",
    source: `export const layer: TokenLayer<
  "x",
  never,
  { defaultVisibility: "internal"; mayStatePublicKeys: "x"; mayStateInternalKeys: never; mayOmitVisibilityKeys: never }
> = {
  kind: "scheme-tokens/token-layer",
  formatVersion: 2,
  id: "forged",
  defaultVisibility: "internal",
  tokens: { x: { value: "1" } },
};`,
    expect: (output) => contains(output, "StaticProof"),
  },
];

for (const diagnostic of diagnosticCases) {
  writeFileSync(
    join(diagnosticsDirectory, `${slug(diagnostic.name)}.ts`),
    `import { defineTokenGraph, defineTokenLayer, tokenConcat, tokenRef, type TokenGraph, type TokenLayer } from "scheme-tokens";\n${diagnostic.source}\nvoid defineTokenGraph;\nvoid tokenConcat;\nvoid defineTokenLayer;\nvoid tokenRef;\nexport type Imported = TokenGraph | TokenLayer;\n`,
  );
}

runPnpm(
  ["install", "--lockfile-only", "--ignore-scripts", "--strict-peer-dependencies"],
  consumerDirectory,
);
runPnpm(
  ["install", "--frozen-lockfile", "--ignore-scripts", "--strict-peer-dependencies"],
  consumerDirectory,
);
process.stdout.write(`Packed type matrix with ${compilerVersion()}\n`);
for (const config of ["tsconfig.strict.json", "tsconfig.stricter.json"]) {
  run(process.execPath, [compiler, "-p", config], consumerDirectory);
  process.stdout.write(`  source matrix (${matrixFiles.length} files) passed: ${config}\n`);
}
for (const file of matrixFiles) {
  readFileSync(
    join(consumerDirectory, "type-declarations", "matrix", file.replace(/\.ts$/u, ".d.ts")),
  );
}
process.stdout.write(
  `  emitted ${matrixFiles.length} consumer declarations with skipLibCheck=false\n`,
);

const diagnostics = typecheckFailure("tsconfig.diagnostics.json");
const failures: string[] = [];
for (const diagnostic of diagnosticCases) {
  const file = `diagnostics/${slug(diagnostic.name)}.ts`;
  const output = diagnostics
    .split(/\r?\n/u)
    .reduce<{ readonly lines: string[]; readonly active: boolean }>(
      (state, line) => {
        const header = /^(?<path>[^(\s]+)\(\d+,\d+\): error TS\d+/u.exec(line);
        const active = header === null ? state.active : header.groups?.path === file;
        return { lines: active ? [...state.lines, line] : state.lines, active };
      },
      { lines: [], active: false },
    )
    .lines.join("\n");
  const problems = output.length === 0 ? ["no rejection"] : diagnostic.expect(output);
  if (problems.length > 0) {
    failures.push(`${diagnostic.name}: ${problems.join("; ")}\n${output}`);
  } else {
    process.stdout.write(`  diagnostic ok: ${diagnostic.name}\n`);
  }
}
if (failures.length > 0) {
  throw new Error(`Packed diagnostic-quality matrix failed:\n${failures.join("\n\n")}`);
}
rmSync(workspace, { recursive: true, force: true });

function suggestion(output: string, key: string): readonly string[] {
  return /Did you mean '"(?<key>[^"]+)"'\?/u.exec(output)?.groups?.key === key
    ? []
    : [`expected a suggestion for "${key}"`];
}

function contains(output: string, fragment: string): readonly string[] {
  return output.includes(fragment) ? [] : [`expected ${fragment}`];
}

// Union members may print in any order; compare each argument as a set.
function mismatch(
  output: string,
  layerModes: readonly string[],
  graphModes: readonly string[],
): readonly string[] {
  const members = (text: string | undefined) =>
    JSON.stringify(
      [...(text ?? "").matchAll(/"(?<mode>[^"]+)"/gu)].map((match) => match.groups?.mode).sort(),
    );
  // TypeScript abbreviates some occurrences as `LayerModeMismatch<...>`; one must be complete.
  const named = [...output.matchAll(/LayerModeMismatch<(?<body>[^>]*)>/gu)].some((match) => {
    const [layer, graph, ...rest] = match.groups?.body?.split(/,\s*/u) ?? [];
    return (
      rest.length === 0 &&
      members(layer) === JSON.stringify([...layerModes].sort()) &&
      members(graph) === JSON.stringify([...graphModes].sort())
    );
  });
  return named ? [] : ["expected LayerModeMismatch<layer modes, graph modes>"];
}

function typecheckFailure(config: string): string {
  try {
    run(process.execPath, [compiler, "-p", config], consumerDirectory);
  } catch (error) {
    const failure = error as { readonly stdout?: string };
    return failure.stdout ?? "";
  }
  throw new Error("The diagnostic cases unexpectedly typechecked");
}

function compilerVersion(): string {
  return run(process.execPath, [compiler, "--version"], consumerDirectory).trim();
}

function slug(name: string): string {
  return name.toLowerCase().replaceAll(/[^a-z0-9]+/gu, "-");
}

function pack(destination: string): string {
  const output = runPnpm(["pack", "--pack-destination", destination], repoRoot)
    .trim()
    .split(/\r?\n/u)
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
