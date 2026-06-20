import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
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
    [manifest.name]: `file:${tarball.replaceAll("\\", "/")}`,
  },
});
writeJson(join(consumerDirectory, "tsconfig.json"), {
  compilerOptions: {
    strict: true,
    skipLibCheck: false,
    module: "NodeNext",
    moduleResolution: "NodeNext",
    target: "ES2022",
    noEmit: true,
    types: [],
  },
  include: ["types.ts"],
});
writeFileSync(
  join(consumerDirectory, "root.mjs"),
  `
import { buildScheme, compileTokenGraph, defineTokenGraph, defineTokenLayer, defineTokens, exportCssVariableBlocks, exportCssVariables } from ${JSON.stringify(manifest.name)};

const graph = defineTokens({
  background: "#ffffff",
  foreground: "#111111",
  primary: "#6750a4",
  "primary-foreground": "#ffffff",
});
const compiled = compileTokenGraph(graph);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.issues));
const css = exportCssVariables(compiled.value);
if (!css.ok || !css.value.includes("--background: #ffffff;")) throw new Error("root workflow failed");
const blocks = exportCssVariableBlocks(compiled.value);
if (!blocks.ok) throw new Error(JSON.stringify(blocks.issues));
const declarations = blocks.value[0]?.declarations;
if (declarations?.["--background"] !== "#ffffff") throw new Error("structured CSS export failed");
if (Object.keys(declarations ?? {}).some((name) => name.startsWith("--undefined-") || name.startsWith("---"))) {
  throw new Error("unprefixed export produced a malformed custom property");
}
const base = defineTokenLayer({ id: "base", tokens: { primary: "#6750a4" } });
const brand = defineTokenLayer({ id: "brand", tokens: { primary: "#ff3b30" } });
const built = buildScheme({ layers: [base, brand] });
if (!built.ok) throw new Error(JSON.stringify(built.issues));
if (built.value.graph.tokens.primary?.origin?.kind !== "layer") throw new Error("layer-only origin failed");
const lightDarkLayer = defineTokenLayer({
  id: "application",
  modes: ["light", "dark"],
  tokens: {
    background: {
      light: "#ffffff",
      dark: "#141218",
    },
  },
});
const lightDarkBuilt = buildScheme({
  modes: ["light", "dark"],
  defaultMode: "light",
  layers: [lightDarkLayer],
});
if (!lightDarkBuilt.ok) throw new Error(JSON.stringify(lightDarkBuilt.issues));
if (lightDarkBuilt.value.compiled.tokens.background?.valueByMode.dark?.colorSpace !== "srgb") {
  throw new Error("layer-only multi-mode build failed");
}
`,
);
writeFileSync(
  join(consumerDirectory, "subpaths.mjs"),
  `
for (const subpath of ["conversion", "sources/material3"]) {
  try {
    await import(${JSON.stringify(manifest.name)} + "/" + subpath);
    throw new Error("unexpected subpath import success: " + subpath);
  } catch (error) {
    const marker =
      typeof error?.code === "string"
        ? error.code
        : typeof error?.message === "string"
          ? error.message
          : "";
    if (!marker.includes("ERR_PACKAGE_PATH_NOT_EXPORTED")) {
      throw error;
    }
  }
}
`,
);
writeFileSync(
  join(consumerDirectory, "schema-subpaths.mjs"),
  `
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const expectedSchemas = new Map([
  ["schemas/token-graph.v1.schema.json", "scheme-tokens token graph v1"],
  ["schemas/token-layer.v1.schema.json", "scheme-tokens token layer v1"],
  ["schemas/compiled-scheme.v1.schema.json", "scheme-tokens compiled scheme v1"],
]);

for (const [subpath, title] of expectedSchemas) {
  const packageSubpath = ${JSON.stringify(manifest.name)} + "/" + subpath;
  const schema = require(packageSubpath);
  if (schema?.$schema !== "https://json-schema.org/draft/2020-12/schema") {
    throw new Error("schema artifact is missing the draft marker: " + subpath);
  }
  if (schema.title !== title) {
    throw new Error("schema artifact title mismatch: " + subpath);
  }
  const resolved = require.resolve(packageSubpath).replaceAll("\\\\", "/");
  if (!resolved.endsWith("/" + subpath)) {
    throw new Error("schema subpath resolved outside expected artifact: " + resolved);
  }
}
`,
);
writeFileSync(
  join(consumerDirectory, "types.ts"),
  `
import {
  buildScheme,
  compileTokenGraph,
  defineTokenLayer,
  defineTokenGraph,
  defineTokens,
  exportCssVariableBlocks,
  type BuildSchemeSourceOptions,
  type CssVariableBlock,
  type ColorValue,
  type CompiledScheme,
  type ExportCssVariablesOptions,
  type Issue,
  type Result,
  type TokenGraphInput,
  type TokenLayerInput,
} from ${JSON.stringify(manifest.name)};

const graph: TokenGraphInput<"base"> = defineTokenGraph({
  tokens: { "app.background": "#ffffff", "app.foreground": "app.background" },
});
const tokenGraph: TokenGraphInput<"base"> = defineTokens({
  "app.background": "#ffffff",
  "app.foreground": "app.background",
});
const layer: TokenLayerInput = defineTokenLayer({
  id: "brand",
  tokens: { "brand.primary": "#6750a4" },
});
const compiled: Result<CompiledScheme, Issue> = compileTokenGraph(graph);
const cssOptions: ExportCssVariablesOptions = { prefix: "theme" };
const legacyCssOptions: ExportCssVariablesOptions = {
  // @ts-expect-error variablePrefix is not part of the public CSS export options.
  variablePrefix: "theme",
};
const color: ColorValue = { colorSpace: "srgb", r: 1, g: 1, b: 1, alpha: 1 };
const blocks = exportCssVariableBlocks({} as never);
const cssBlock: CssVariableBlock | undefined = blocks.ok ? blocks.value[0] : undefined;
const source = {
  id: "brand",
  build() {
    return { ok: true as const, value: graph };
  },
};
const built = buildScheme({ sources: [source] });
const shorthandBuilt = buildScheme(source, { selection: "all" } satisfies BuildSchemeSourceOptions);
const layerBuilt = buildScheme({ layers: [layer] });
const lightDarkLayer = defineTokenLayer<"light" | "dark">({
  id: "application",
  modes: ["light", "dark"],
  tokens: { background: { light: "#ffffff", dark: "#141218" } },
});
const lightDarkBuilt = buildScheme({
  modes: ["light", "dark"],
  defaultMode: "light",
  layers: [lightDarkLayer],
});
cssOptions.prefix?.toUpperCase();
legacyCssOptions.prefix?.toUpperCase();
cssBlock?.declarations["--background"]?.toUpperCase();
color.colorSpace.toUpperCase();
if (compiled.ok) compiled.value.defaultMode.toUpperCase();
tokenGraph.defaultMode.toUpperCase();
if (built.ok) built.value.compiled.defaultMode.toUpperCase();
if (shorthandBuilt.ok) shorthandBuilt.value.compiled.defaultMode.toUpperCase();
if (layerBuilt.ok) layerBuilt.value.compiled.defaultMode.toUpperCase();
if (lightDarkBuilt.ok) lightDarkBuilt.value.compiled.defaultMode.toUpperCase();
`,
);

runPnpm(["install", "--ignore-scripts"], consumerDirectory);
for (const script of ["root.mjs", "subpaths.mjs", "schema-subpaths.mjs"]) {
  run("node", [script], consumerDirectory);
}
run(
  "node",
  [join(repoRoot, "node_modules", "typescript", "bin", "tsc"), "-p", "tsconfig.json"],
  consumerDirectory,
);

const installedRoot = join(consumerDirectory, "node_modules", manifest.name);
if (existsSync(join(consumerDirectory, "node_modules", "@scheme-tokens", "source-material3"))) {
  throw new Error("core-only consumer unexpectedly installed the Material adapter");
}
if (existsSync(join(consumerDirectory, "node_modules", "@material", "material-color-utilities"))) {
  throw new Error("core-only consumer unexpectedly installed the Material engine");
}
const rootJs = readFileSync(join(installedRoot, "dist", "index.js"), "utf8");
if (
  rootJs.includes("@texel/color") ||
  rootJs.includes("@material/material-color-utilities") ||
  rootJs.includes("css-tree")
) {
  throw new Error("Packed root entry loads optional engines");
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
