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
import { buildScheme, compileTokenGraph, createSchemeBuilder, defineTokenGraph, defineTokenLayer, defineTokens, exportCssVars, parseCompiledScheme, tokenRef } from ${JSON.stringify(manifest.name)};

const graph = defineTokens({
  background: "#ffffff",
  foreground: "#111111",
  primary: "#6750a4",
  "primary-foreground": "#ffffff",
});
const compiled = compileTokenGraph(graph);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.issues));
const cssExport = exportCssVars(compiled.value);
if (!cssExport.ok || !cssExport.value.css.includes("--background: #ffffff;")) throw new Error("root workflow failed");
if (cssExport.value.css.includes("--color-background") || cssExport.value.css.includes("--scheme-background")) {
  throw new Error("default CSS export must use authored runtime token names");
}
const prefixedCssExport = exportCssVars(compiled.value, { prefix: "color" });
if (!prefixedCssExport.ok || !prefixedCssExport.value.css.includes("--color-background: #ffffff;")) {
  throw new Error("explicit CSS prefix export failed");
}
const appGraph = defineTokenGraph({
  tokens: {
    "brand.primary": {
      value: "#6750a4",
      visibility: "internal",
    },
    primary: tokenRef("brand.primary"),
  },
});
const appCompiled = compileTokenGraph(appGraph);
if (!appCompiled.ok) throw new Error(JSON.stringify(appCompiled.issues));
if (!("primary" in appCompiled.value.tokens) || "brand.primary" in appCompiled.value.tokens) {
  throw new Error("app token public selection failed");
}
const aliasGraph = defineTokenGraph({
  tokens: {
    "brand.primary": "#6750a4",
  },
  aliases: {
    "app.primary": "brand.primary",
  },
});
const aliasCompiled = compileTokenGraph(aliasGraph);
if (!aliasCompiled.ok || !("app.primary" in aliasCompiled.value.tokens)) {
  throw new Error("token aliases field compile failed");
}
const declarations = cssExport.value.blocks[0]?.declarations;
if (declarations?.[0]?.property !== "--background" || declarations?.[0]?.value !== "#ffffff") {
  throw new Error("structured CSS export failed");
}
if (declarations?.some((declaration) => declaration.property === "--color-background" || declaration.property === "--scheme-background")) {
  throw new Error("structured CSS export must be unprefixed by default");
}
if (declarations?.some((declaration) => declaration.property.startsWith("--undefined-") || declaration.property.startsWith("---"))) {
  throw new Error("unprefixed export produced a malformed custom property");
}
if (cssExport.value.variableByToken.background !== "--background") throw new Error("CSS custom-property lookup failed");
if (!parseCompiledScheme(compiled.value).ok) throw new Error("compiled parse boundary failed");
const base = defineTokenLayer({ id: "base", tokens: { primary: "#6750a4" } });
const brand = defineTokenLayer({ id: "brand", tokens: { primary: "#ff3b30" } });
const built = buildScheme({ layers: [base, brand] });
if (!built.ok) throw new Error(JSON.stringify(built.issues));
if (built.value.tokens.primary?.origin?.kind !== "layer") throw new Error("layer-only origin failed");
const builder = createSchemeBuilder({ layers: [base, brand] });
const preparedBuilt = builder.build();
if (!preparedBuilt.ok) throw new Error(JSON.stringify(preparedBuilt.issues));
if (preparedBuilt.value.tokens.primary?.origin?.kind !== "layer") throw new Error("prepared layer-only origin failed");
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
if (lightDarkBuilt.value.tokens.background?.valueByMode.dark?.colorSpace !== "srgb") {
  throw new Error("layer-only multi-mode build failed");
}
`,
);
writeFileSync(
  join(consumerDirectory, "subpaths.mjs"),
  `
for (const subpath of ["conversion", "material3"]) {
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
  ["schemas/color-token-graph.v1.schema.json", "scheme-tokens color token graph v1"],
  ["schemas/color-token-layer.v1.schema.json", "scheme-tokens color token layer v1"],
  ["schemas/compiled-color-scheme.v1.schema.json", "scheme-tokens compiled color scheme v1"],
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
  createSchemeBuilder,
  defineTokenLayer,
  defineTokenGraph,
  defineTokens,
  exportCssVars,
  tokenRef,
  type BuildSchemeSourceOptions,
  type CssVarBlock,
  type CssVarsExport,
  type ColorValue,
  type CompiledColorScheme,
  type ExportCssVarsOptions,
  type Issue,
  type Result,
  type SchemeBuilder,
  type SchemeBuilderConfig,
  type ColorTokenGraphInput,
  type ColorTokenLayerInput,
  type ModeOf,
  type TokenKeyOf,
} from ${JSON.stringify(manifest.name)};

const graph: ColorTokenGraphInput<"base"> = defineTokenGraph({
  tokens: {
    "app.background": {
      value: "#ffffff",
      visibility: "internal",
    },
    "app.foreground": tokenRef("app.background"),
  },
});
const colorTokenGraph: ColorTokenGraphInput<"base"> = defineTokens({
  "app.background": "#ffffff",
  "app.foreground": tokenRef("app.background"),
});
const aliasGraph = defineTokenGraph({
  tokens: {
    "brand.primary": "#6750a4",
  },
  aliases: {
    "app.primary": "brand.primary",
  },
});
const layer: ColorTokenLayerInput = defineTokenLayer({
  id: "brand",
  tokens: { "brand.primary": "#6750a4" },
});
const compiled: Result<CompiledColorScheme, Issue> = compileTokenGraph(graph);
const cssOptions: ExportCssVarsOptions = { prefix: "theme" };
const legacyCssOptions: ExportCssVarsOptions = {
  // @ts-expect-error variablePrefix is not part of the public CSS export options.
  variablePrefix: "theme",
};
const color: ColorValue = { colorSpace: "srgb", components: [1, 1, 1], alpha: 1 };
const tokenKey: TokenKeyOf<typeof graph> = "app.background";
const mode: ModeOf<typeof graph> = "base";
const cssExport = exportCssVars({} as never);
const cssVarsExport: CssVarsExport | undefined = cssExport.ok ? cssExport.value : undefined;
const cssBlock: CssVarBlock | undefined = cssVarsExport?.blocks[0];
const source = {
  id: "brand",
  build() {
    return { ok: true as const, value: graph };
  },
};
const built = buildScheme({ base: [source] });
const shorthandBuilt = buildScheme(source, { selection: "all" } satisfies BuildSchemeSourceOptions);
const layerBuilt = buildScheme({ layers: [layer] });
const builderConfig: SchemeBuilderConfig = { layers: [layer] };
const builder: SchemeBuilder = createSchemeBuilder(builderConfig);
const preparedBuilt = builder.build(source);
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
cssVarsExport?.css.toUpperCase();
cssBlock?.declarations[0]?.property.toUpperCase();
cssBlock?.declarations[0]?.value.toUpperCase();
cssVarsExport?.variableByToken["app.background"]?.toUpperCase();
color.colorSpace.toUpperCase();
tokenKey.toUpperCase();
mode.toUpperCase();
if (compiled.ok) compiled.value.defaultMode.toUpperCase();
colorTokenGraph.defaultMode.toUpperCase();
const aliasValue = aliasGraph.tokens["app.primary"].value;
if (typeof aliasValue === "object" && aliasValue !== null && "ref" in aliasValue) {
  aliasValue.ref.toUpperCase();
}
if (built.ok) built.value.defaultMode.toUpperCase();
if (shorthandBuilt.ok) shorthandBuilt.value.defaultMode.toUpperCase();
if (layerBuilt.ok) layerBuilt.value.defaultMode.toUpperCase();
if (preparedBuilt.ok) preparedBuilt.value.defaultMode.toUpperCase();
if (lightDarkBuilt.ok) lightDarkBuilt.value.defaultMode.toUpperCase();
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
if (existsSync(join(consumerDirectory, "node_modules", "@scheme-tokens", "material3"))) {
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
