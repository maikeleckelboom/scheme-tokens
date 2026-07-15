import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

interface PackageManifest {
  readonly name: string;
}

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(
  readFileSync(join(repoRoot, "package.json"), "utf8"),
) as PackageManifest;
const workspace = mkdtempSync(join(tmpdir(), "scheme-tokens-smoke-"));
const packDirectory = join(workspace, "pack");
const consumerDirectory = join(workspace, "consumer");
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
  include: ["consumer.ts"],
});

writeFileSync(
  join(consumerDirectory, "consumer.ts"),
  `
import tokenGraphSchema from "scheme-tokens/schemas/token-graph.v1.schema.json" with { type: "json" };
import tokenLayerSchema from "scheme-tokens/schemas/token-layer.v1.schema.json" with { type: "json" };
import compiledSchemeSchema from "scheme-tokens/schemas/compiled-scheme.v1.schema.json" with { type: "json" };
import {
  compileTokenGraph,
  defineTokenGraph,
  defineTokenLayer,
  defineTokens,
  exportCssVars,
  parseCompiledScheme,
  parseTokenGraph,
  parseTokenLayer,
  serializeCompiledScheme,
  serializeTokenGraph,
  serializeTokenLayer,
  tokenRef,
  type CompiledScheme,
  type CssVarBlock,
  type CssVarsExport,
  type Result,
  type TokenGraph,
} from "scheme-tokens";

const graph = defineTokens(
  {
    "brand.600": {
      value: {
        light: "oklch(62% 0.18 250)",
        dark: "oklch(78% 0.12 250)",
      },
      visibility: "internal",
    },
    background: { light: "#ffffff", dark: "#111111" },
    primary: {
      value: {
        light: tokenRef("brand.600"),
        dark: tokenRef("brand.600"),
      },
      description: "Primary action fill",
    },
  },
  { modes: ["light", "dark"], defaultMode: "light" },
);

type GraphKey = keyof typeof graph.tokens;
type GraphMode = (typeof graph.modes)[number];
const graphKey: GraphKey = "brand.600";
const graphMode: GraphMode = "dark";
void graphKey;
void graphMode;
// @ts-expect-error literal graph keys remain closed
const invalidGraphKey: GraphKey = "brand.400";
// @ts-expect-error literal graph modes remain closed
const invalidGraphMode: GraphMode = "dim";
void invalidGraphKey;
void invalidGraphMode;

defineTokens({
  "brand.600": "#6750a4",
  // @ts-expect-error tokenRef targets must exist in the closed defineTokens record
  primary: tokenRef("brand.400"),
});

compileTokenGraph(graph, {
  selection: {
    keys: [
      // @ts-expect-error explicit selections preserve the graph key union
      "missing",
    ],
  },
});

const selected = compileTokenGraph(graph, { selection: { keys: ["primary"] } });
if (selected.ok) {
  selected.value.tokens.primary.dark.toUpperCase();
  // @ts-expect-error an exact selection narrows the compiled token record
  selected.value.tokens.background;
}

const compiled = compileTokenGraph(graph);
if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.issues));
}
const resultContract: Result<typeof compiled.value> = compiled;
const schemeContract: CompiledScheme<
  "brand.600" | "background" | "primary",
  "light" | "dark",
  false
> = compiled.value;
const graphContract: TokenGraph<"brand.600" | "background" | "primary", "light" | "dark"> = graph;
void resultContract;
void schemeContract;
void graphContract;

if (compiled.value.tokens.background?.light !== "#ffffff") {
  throw new Error("compiled Result.value token read failed");
}
if (compiled.value.tokens.primary?.dark !== "oklch(78% 0.12 250)") {
  throw new Error("reference resolution failed");
}
if ("brand.600" in compiled.value.tokens) {
  throw new Error("default public selection exposed an internal token");
}

const exported = exportCssVars(compiled.value, {
  prefix: "color",
  modeSelectors: {
    strategy: "selectors",
    selectors: { light: ":root", dark: ".dark" },
  },
});
if (!exported.ok) {
  throw new Error(JSON.stringify(exported.issues));
}
const cssContract: CssVarsExport<
  "brand.600" | "background" | "primary",
  "light" | "dark",
  false
> = exported.value;
const firstBlock: CssVarBlock | undefined = exported.value.blocks[0];
void cssContract;
void firstBlock;
if (!exported.value.css.includes("--color-background: #ffffff;")) {
  throw new Error("packed CSS Result.value output failed");
}
if (exported.value.variableByToken.primary !== "--color-primary") {
  throw new Error("packed variableByToken output failed");
}

const advancedNames = exportCssVars(compiled.value, {
  variableName: ({ segments }) => \`--app-\${segments.join("-")}\`,
});
if (!advancedNames.ok || advancedNames.value.variableByToken.primary !== "--app-primary") {
  throw new Error("advanced variableName callback failed");
}

const layer = defineTokenLayer({
  id: "semantic",
  tokens: {
    primary: { light: tokenRef("brand.600"), dark: tokenRef("brand.600") },
  },
});
const layeredGraph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  tokens: { "brand.600": { light: "#6750a4", dark: "#9a82db" } },
  layers: [layer],
});
const layered = compileTokenGraph(layeredGraph, { selection: "all" });
if (!layered.ok || layered.value.tokens.primary.dark !== "#9a82db") {
  throw new Error("packed layer composition failed");
}

const parsedGraph = parseTokenGraph(JSON.parse(serializeTokenGraph(graph)));
const parsedLayer = parseTokenLayer(JSON.parse(serializeTokenLayer(layer)));
const parsedCompiled = parseCompiledScheme(JSON.parse(serializeCompiledScheme(compiled.value)));
if (!parsedGraph.ok || !parsedLayer.ok || !parsedCompiled.ok) {
  throw new Error("packed strict parse/serialize round trip failed");
}
if (parsedCompiled.ok) {
  const dynamicToken = parsedCompiled.value.tokens.background;
  if (dynamicToken?.light !== "#ffffff") {
    throw new Error("dynamically parsed compiled token was not readable after a presence check");
  }
  // @ts-expect-error untrusted parsed schemes cannot claim complete string-key records
  const completeDynamicScheme: CompiledScheme<string, string, true> = parsedCompiled.value;
  void completeDynamicScheme;
}
if (parsedGraph.value.tokens["brand.600"]?.value === undefined) {
  throw new Error("strict token definitions must expose required value");
}

for (const [schema, title] of [
  [tokenGraphSchema, "scheme-tokens token graph v1"],
  [tokenLayerSchema, "scheme-tokens token layer v1"],
  [compiledSchemeSchema, "scheme-tokens compiled scheme v1"],
] as const) {
  if (schema.$schema !== "https://json-schema.org/draft/2020-12/schema" || schema.title !== title) {
    throw new Error("packed schema import failed: " + title);
  }
}

for (const subpath of ["conversion", "material3"]) {
  const specifier = "scheme-tokens/" + subpath;
  try {
    await import(specifier);
  } catch (error) {
    const marker =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : error instanceof Error
          ? error.message
          : String(error);
    if (marker.includes("ERR_PACKAGE_PATH_NOT_EXPORTED") || marker.includes('not defined by "exports"')) {
      continue;
    }
    throw error;
  }
  throw new Error("unexpected package subpath export: " + specifier);
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

const installedRoot = join(consumerDirectory, "node_modules", manifest.name);
const installedManifest = JSON.parse(readFileSync(join(installedRoot, "package.json"), "utf8")) as {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly optionalDependencies?: Readonly<Record<string, string>>;
  readonly peerDependencies?: Readonly<Record<string, string>>;
};
if (
  Object.keys(installedManifest.dependencies ?? {}).length > 0 ||
  Object.keys(installedManifest.optionalDependencies ?? {}).length > 0 ||
  Object.keys(installedManifest.peerDependencies ?? {}).length > 0
) {
  throw new Error("Packed core consumer leaked a dependency type/runtime graph");
}
if (existsSync(join(consumerDirectory, "node_modules", "@scheme-tokens", "material3"))) {
  throw new Error("Packed core consumer unexpectedly installed an engine package");
}
const rootJs = readFileSync(join(installedRoot, "dist", "index.js"), "utf8");
for (const forbiddenText of [
  "@texel/color",
  "@material/material-color-utilities",
  "css-tree",
  "material3",
]) {
  if (rootJs.includes(forbiddenText)) {
    throw new Error(`Packed root entry leaks optional engine text: ${forbiddenText}`);
  }
}

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
