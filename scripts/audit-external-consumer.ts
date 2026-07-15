import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative } from "node:path";

const repoRoot = process.cwd();
const workspace = mkdtempSync(join(tmpdir(), "scheme-tokens-external-audit-"));
const packDirectory = join(workspace, "pack");
const consumerDirectory = join(workspace, "consumer");
mkdirSync(packDirectory, { recursive: true });
mkdirSync(consumerDirectory, { recursive: true });

const tarball = pack(repoRoot, packDirectory);
writeJson(join(consumerDirectory, "package.json"), {
  private: true,
  type: "module",
  dependencies: {
    "scheme-tokens": fileDependencySpec(consumerDirectory, tarball),
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
    rootDir: ".",
    outDir: "dist",
  },
  include: ["consumer.ts"],
});

writeFileSync(
  join(consumerDirectory, "consumer.ts"),
  `
import {
  compileTokenGraph,
  defineTokens,
  exportCssVars,
  parseCompiledScheme,
  parseTokenGraph,
  serializeCompiledScheme,
  serializeTokenGraph,
  tokenRef,
  type CompiledScheme,
  type CssVarsExport,
} from "scheme-tokens";

const graph = defineChromavertGraph(false);
const permutedGraph = defineChromavertGraph(true);

type ChromavertTokenKey = keyof typeof graph.tokens;
type ChromavertMode = (typeof graph.modes)[number];
const generatedKey: ChromavertTokenKey = "generated.brand.600";
const darkMode: ChromavertMode = "dark";
void generatedKey;
void darkMode;
// @ts-expect-error the packed declaration preserves the complete literal key union
const invalidGeneratedKey: ChromavertTokenKey = "generated.brand.800";
// @ts-expect-error the packed declaration preserves the explicit light/dark mode union
const invalidMode: ChromavertMode = "dim";
void invalidGeneratedKey;
void invalidMode;

defineTokens({
  "generated.brand.600": "oklch(62% 0.18 250)",
  // @ts-expect-error tokenRef cannot target a missing key in a closed defineTokens record
  "semantic.primary": tokenRef("generated.brand.800"),
});

compileTokenGraph(graph, {
  selection: {
    keys: [
      // @ts-expect-error explicit selection keys remain tied to the authored graph
      "semantic.missing",
    ],
  },
});

const publicCompiled = expectOk(compileTokenGraph(graph), "compile public semantics");
const publicContract: CompiledScheme<
  ChromavertTokenKey,
  ChromavertMode,
  false
> = publicCompiled;
void publicContract;
for (const internalKey of ["generated.brand.400", "generated.brand.600", "repair.primary.dark"]) {
  if (internalKey in publicCompiled.tokens) {
    throw new Error("public selection exposed internal source token: " + internalKey);
  }
}
if (publicCompiled.tokens["semantic.action"]?.light !== "oklch(62% 0.18 250)") {
  throw new Error("public semantic light chain did not resolve to generated source output");
}
if (publicCompiled.tokens["semantic.action"]?.dark !== "oklch(72% 0.14 255)") {
  throw new Error("public semantic dark chain did not resolve to explicit repair output");
}

const allCompiled = expectOk(
  compileTokenGraph(graph, { selection: "all" }),
  "compile full Chromavert-shaped graph",
);
const completeAllContract: CompiledScheme<
  ChromavertTokenKey,
  ChromavertMode,
  true
> = allCompiled;
void completeAllContract;
if (
  sourceLeaf(allCompiled, "semantic.action", "light") !== "generated.brand.600" ||
  sourceLeaf(allCompiled, "semantic.action", "dark") !== "repair.primary.dark"
) {
  throw new Error("multi-hop source identity was not recoverable from dependency metadata");
}
assertArrayEqual(
  allCompiled.metadataByToken["semantic.action"].dependenciesByMode.light,
  ["semantic.primary"],
  "semantic action direct dependency",
);
assertArrayEqual(
  allCompiled.metadataByToken["semantic.primary"].dependenciesByMode.light,
  ["generated.brand.600"],
  "semantic primary light dependency",
);
assertArrayEqual(
  allCompiled.metadataByToken["semantic.primary"].dependenciesByMode.dark,
  ["repair.primary.dark"],
  "semantic primary dark repair dependency",
);

const permutedCompiled = expectOk(
  compileTokenGraph(permutedGraph, { selection: "all" }),
  "compile insertion-order permutation",
);
const exactCompiled = expectOk(
  compileTokenGraph(graph, { selection: { keys: ["semantic.action"] } }),
  "compile exact semantic selection",
);
const completeExactContract: CompiledScheme<"semantic.action", ChromavertMode, true> =
  exactCompiled;
if (completeExactContract.tokens["semantic.action"].dark !== "oklch(72% 0.14 255)") {
  throw new Error("exact selection did not preserve complete token access");
}
const serializedGraph = serializeTokenGraph(graph);
if (serializedGraph !== serializeTokenGraph(permutedGraph)) {
  throw new Error("graph serialization depends on construction order");
}
const serializedCompiled = serializeCompiledScheme(allCompiled);
if (serializedCompiled !== serializeCompiledScheme(permutedCompiled)) {
  throw new Error("compiled serialization depends on construction order");
}

const parsedGraph = expectOk(
  parseTokenGraph(JSON.parse(serializedGraph)),
  "parse strict persisted Chromavert graph",
);
const reparsedCompiled = expectOk(
  compileTokenGraph(parsedGraph, { selection: "all" }),
  "compile parsed persisted graph",
);
if (serializeCompiledScheme(reparsedCompiled) !== serializedCompiled) {
  throw new Error("strict graph parse/compile round trip changed the deterministic artifact");
}
const parsedCompiled = expectOk(
  parseCompiledScheme(JSON.parse(serializedCompiled)),
  "parse compiled artifact",
);
const dynamicCompiledToken = parsedCompiled.tokens["semantic.action"];
if (dynamicCompiledToken?.dark !== "oklch(72% 0.14 255)") {
  throw new Error("dynamic compiled parse was not readable after a presence check");
}
// @ts-expect-error dynamically parsed string-key schemes remain conservatively incomplete
const invalidCompleteParsed: CompiledScheme<string, string, true> = parsedCompiled;
void invalidCompleteParsed;
if (serializeCompiledScheme(parsedCompiled) !== serializedCompiled) {
  throw new Error("compiled parse/serialize round trip changed bytes");
}

const publicCss = expectOk(
  exportCssVars(publicCompiled, {
    prefix: "color",
    modeSelectors: {
      strategy: "selectors",
      selectors: { light: ":root", dark: ".dark" },
    },
  }),
  "export public Chromavert CSS",
);
const publicCssContract: CssVarsExport<ChromavertTokenKey, ChromavertMode, false> = publicCss;
void publicCssContract;
const permutedPublic = expectOk(
  compileTokenGraph(permutedGraph),
  "compile permuted public semantics",
);
const permutedCss = expectOk(
  exportCssVars(permutedPublic, {
    prefix: "color",
    modeSelectors: {
      strategy: "selectors",
      selectors: { dark: ".dark", light: ":root" },
    },
  }),
  "export permuted public CSS",
);
if (publicCss.css !== permutedCss.css || publicCss.blocks.length !== 2) {
  throw new Error("CSS artifacts depend on construction or selector-map order");
}
if (publicCss.variableByToken["semantic.action"] !== "--color-semantic--action") {
  throw new Error("semantic token CSS variable lookup was not preserved");
}

function defineChromavertGraph(reverse: boolean) {
  const definitions = reverse
    ? {
        "semantic.action": tokenRef("semantic.primary"),
        "semantic.primary": {
          value: {
            dark: tokenRef("repair.primary.dark"),
            light: tokenRef("generated.brand.600"),
          },
          description: "Primary interactive fill",
        },
        "repair.primary.dark": {
          value: {
            dark: "oklch(72% 0.14 255)",
            light: tokenRef("generated.brand.600"),
          },
          visibility: "internal" as const,
          description: "Explicit dark-mode repair output",
        },
        "generated.brand.600": {
          value: { dark: "oklch(78% 0.12 250)", light: "oklch(62% 0.18 250)" },
          visibility: "internal" as const,
        },
        "generated.brand.400": {
          value: { dark: "oklch(84% 0.09 250)", light: "oklch(76% 0.13 250)" },
          visibility: "internal" as const,
        },
        background: { dark: "#111111", light: "#ffffff" },
      }
    : {
        background: { light: "#ffffff", dark: "#111111" },
        "generated.brand.400": {
          value: { light: "oklch(76% 0.13 250)", dark: "oklch(84% 0.09 250)" },
          visibility: "internal" as const,
        },
        "generated.brand.600": {
          value: { light: "oklch(62% 0.18 250)", dark: "oklch(78% 0.12 250)" },
          visibility: "internal" as const,
        },
        "repair.primary.dark": {
          value: {
            light: tokenRef("generated.brand.600"),
            dark: "oklch(72% 0.14 255)",
          },
          visibility: "internal" as const,
          description: "Explicit dark-mode repair output",
        },
        "semantic.primary": {
          value: {
            light: tokenRef("generated.brand.600"),
            dark: tokenRef("repair.primary.dark"),
          },
          description: "Primary interactive fill",
        },
        "semantic.action": tokenRef("semantic.primary"),
      };

  return defineTokens(definitions, {
    modes: reverse ? (["dark", "light"] as const) : (["light", "dark"] as const),
    defaultMode: "light",
  });
}

function sourceLeaf(
  scheme: CompiledScheme,
  start: string,
  mode: string,
): string | undefined {
  const seen = new Set<string>();
  let current = start;
  while (!seen.has(current)) {
    seen.add(current);
    const dependency = scheme.metadataByToken[current]?.dependenciesByMode[mode]?.[0];
    if (dependency === undefined) {
      return current;
    }
    current = dependency;
  }
  return undefined;
}

function expectOk<Value>(
  result: { readonly ok: true; readonly value: Value } | { readonly ok: false; readonly issues: readonly unknown[] },
  label: string,
): Value {
  if (!result.ok) {
    throw new Error(label + " failed: " + JSON.stringify(result.issues));
  }
  return result.value;
}

function assertArrayEqual(actual: readonly string[], expected: readonly string[], label: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(label + " mismatch: " + JSON.stringify(actual));
  }
}
`,
);

runPnpm(["install", "--ignore-scripts"], consumerDirectory);
run(
  process.execPath,
  [join(repoRoot, "node_modules", "typescript", "bin", "tsc"), "-p", "tsconfig.json"],
  consumerDirectory,
);
run(process.execPath, [join("dist", "consumer.js")], consumerDirectory);

process.stdout.write(
  `${JSON.stringify(
    {
      workspace,
      consumerDirectory,
      tarball,
    },
    null,
    2,
  )}\n`,
);

function pack(cwd: string, destination: string): string {
  const output = runPnpm(["pack", "--pack-destination", destination], cwd)
    .trim()
    .split(/\r?\n/)
    .at(-1);
  if (output === undefined) {
    throw new Error(`Unable to determine packed tarball name for ${cwd}`);
  }
  return join(destination, basename(output));
}

function fileDependencySpec(fromDirectory: string, tarballPath: string): string {
  return `file:${relative(fromDirectory, tarballPath).replaceAll("\\", "/")}`;
}

function runPnpm(args: readonly string[], cwd: string): string {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath !== undefined) {
    return run(process.execPath, [npmExecPath, ...args], cwd);
  }
  return process.platform === "win32"
    ? run("cmd.exe", ["/d", "/s", "/c", "pnpm", ...args], cwd)
    : run("pnpm", args, cwd);
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
