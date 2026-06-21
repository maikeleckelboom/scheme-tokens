import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative } from "node:path";

const repoRoot = process.cwd();
const adapterRoot = join(repoRoot, "packages", "material3");
const workspace = mkdtempSync(join(tmpdir(), "scheme-tokens-external-audit-"));
const packDirectory = join(workspace, "pack");
const rootConsumerDirectory = join(workspace, "root-consumer");
const adapterConsumerDirectory = join(workspace, "adapter-consumer");

mkdirSync(packDirectory, { recursive: true });
mkdirSync(rootConsumerDirectory, { recursive: true });
mkdirSync(adapterConsumerDirectory, { recursive: true });

const rootTarball = pack(repoRoot, packDirectory);
const adapterTarball = pack(adapterRoot, packDirectory);

writeRootConsumer();
runPnpm(["install", "--ignore-scripts"], rootConsumerDirectory);
run("node", ["root-audit.mjs"], rootConsumerDirectory);

writeAdapterConsumer();
runPnpm(["install", "--ignore-scripts"], adapterConsumerDirectory);
run("node", ["adapter-audit.mjs"], adapterConsumerDirectory);

nodeWrite(
  JSON.stringify(
    {
      workspace,
      rootConsumerDirectory,
      adapterConsumerDirectory,
      rootTarball,
      adapterTarball,
    },
    null,
    2,
  ),
);

function writeRootConsumer(): void {
  writeJson(join(rootConsumerDirectory, "package.json"), {
    private: true,
    type: "module",
    dependencies: {
      "scheme-tokens": fileDependencySpec(rootConsumerDirectory, rootTarball),
    },
  });
  writeFileSync(
    join(rootConsumerDirectory, "root-audit.mjs"),
    `
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import {
  compileTokenGraph,
  defineTokenLayer,
  defineTokenGraph,
  defineTokens,
  exportCssVars,
  parseCompiledScheme,
  parseTokenGraph,
  parseTokenLayer,
  serializeCompiledScheme,
  tokenRef,
} from "scheme-tokens";

const require = createRequire(import.meta.url);
const graph = defineTokens(
  {
    background: { light: "#ffffff", dark: "oklch(0.18 0.02 285)" },
    foreground: { light: "#111111", dark: "#f5eff7" },
    primary: {
      light: "color(display-p3 0.42 0.32 0.74)",
      dark: "oklch(0.82 0.09 292)",
    },
    "primary-foreground": { light: "#ffffff", dark: "#1d1330" },
  },
  { modes: ["light", "dark"], defaultMode: "light" },
);
const compiled = expectOk(compileTokenGraph(graph), "compile default public selection");
if (!("background" in compiled.tokens) || compiled.tokens.background.valueByMode.dark.colorSpace !== "oklch") {
  throw new Error("root compile did not preserve light/dark public tokens");
}
const cssExport = expectOk(exportCssVars(compiled), "export root CSS");
writeFileSync("tokens.css", cssExport.css);
if (!cssExport.css.includes(":root {") || !cssExport.css.includes(':root[data-color-scheme="dark"] {')) {
  throw new Error("default selectors were not emitted");
}
if (cssExport.blocks.length !== 2 || cssExport.blocks[0].selector !== ":root") {
  throw new Error("structured CSS blocks are not ordered or readable");
}
if (cssExport.variableByToken.primary !== "--primary") {
  throw new Error("variableByToken did not expose the generated CSS custom property");
}
const serialized = serializeCompiledScheme(compiled);
const parsedCompiled = expectOk(parseCompiledScheme(JSON.parse(serialized)), "parse compiled scheme");
if (parsedCompiled.kind !== "scheme-tokens/compiled-color-scheme") {
  throw new Error("compiled artifact kind was not preserved");
}

const refGraph = defineTokens({
  "brand.primary": "#6750a4",
  primary: tokenRef("brand.primary"),
});
expectOk(compileTokenGraph(refGraph, { selection: "all" }), "tokenRef compile");
const aliasGraph = defineTokenGraph({
  tokens: {
    "brand.primary": "#6750a4",
  },
  aliases: {
    primary: "brand.primary",
  },
});
expectOk(compileTokenGraph(aliasGraph, { selection: "all" }), "aliases field compile");
const appGraph = defineTokenGraph({
  tokens: {
    "brand.primary": {
      value: "#6750a4",
      visibility: "internal",
    },
    primary: tokenRef("brand.primary"),
  },
});
const appCompiled = expectOk(compileTokenGraph(appGraph), "app token compile");
if (!("primary" in appCompiled.tokens) || "brand.primary" in appCompiled.tokens) {
  throw new Error("app token did not compile as the public product lane");
}
for (const value of ["red", "brand.primary", "var(--x)"]) {
  expectThrow(() => defineTokens({ sample: value }), "Use tokenRef");
}

const structuredColor = {
  colorSpace: "srgb",
  components: [0.403921568627451, 0.3137254901960784, 0.6431372549019608],
  alpha: 1,
  hex: "#6750a4",
};
const persistedGraph = {
  kind: "scheme-tokens/color-token-graph",
  formatVersion: 1,
  modes: ["base"],
  defaultMode: "base",
  defaultVisibility: "public",
  tokens: {
    primary: {
      value: structuredColor,
      extensions: { owner: "audit", nested: { stable: true } },
    },
  },
};
const parsedGraph = expectOk(parseTokenGraph(persistedGraph), "parse strict graph");
if (parsedGraph.tokens.primary.extensions?.nested?.stable !== true) {
  throw new Error("opaque extensions were not preserved");
}
expectFail(parseTokenGraph({ tokens: { primary: "#6750a4" } }), "missing-property");
expectFail(parseTokenGraph({ ...persistedGraph, kind: "scheme-tokens/token-graph" }), "invalid-artifact-kind");
expectFail(parseTokenGraph({ ...persistedGraph, tokens: { primary: { value: "#6750a4" } } }), "unsupported-color-syntax");
const layer = {
  kind: "scheme-tokens/color-token-layer",
  formatVersion: 1,
  id: "app",
  defaultVisibility: "public",
  tokens: { primary: { value: structuredColor } },
};
expectOk(parseTokenLayer(layer), "parse strict layer");
expectFail(parseTokenLayer({ ...layer, kind: "scheme-tokens/token-layer" }), "invalid-artifact-kind");
expectFail(parseCompiledScheme({ ...JSON.parse(serialized), kind: "scheme-tokens/compiled-scheme" }), "invalid-artifact-kind");

const exactCssExport = expectOk(
  exportCssVars(compiled, {
    modeSelectors: {
      strategy: "selectors",
      selectors: { light: ".theme-light, :root", dark: ".theme-dark .surface" },
    },
  }),
  "exact selectors",
);
if (!exactCssExport.css.includes(".theme-dark .surface {")) {
  throw new Error("exact mode selectors were not emitted");
}
expectFail(
  exportCssVars(compiled, {
    scope: { strategy: "selector", selector: ".app .preview" },
    modeSelectors: { strategy: "data-attribute", attribute: "data-theme" },
  }),
  "invalid-scope",
);
expectFail(
  exportCssVars(compiled, {
    scope: { strategy: "selector", selector: ".app:hover" },
    modeSelectors: { strategy: "class", classPrefix: "theme-" },
  }),
  "invalid-scope",
);
expectFail(exportCssVars(compiled, { variableName: () => "--same" }), "duplicate-css-variable");

for (const subpath of [
  "schemas/color-token-graph.v1.schema.json",
  "schemas/color-token-layer.v1.schema.json",
  "schemas/compiled-color-scheme.v1.schema.json",
]) {
  const schema = require("scheme-tokens/" + subpath);
  if (schema.$schema !== "https://json-schema.org/draft/2020-12/schema") {
    throw new Error("schema did not load from packed subpath: " + subpath);
  }
}
for (const oldSubpath of [
  "schemas/token-graph.v1.schema.json",
  "schemas/token-layer.v1.schema.json",
  "schemas/compiled-scheme.v1.schema.json",
]) {
  expectPackagePathNotExported(() => require("scheme-tokens/" + oldSubpath));
}

if (existsSync("node_modules/@scheme-tokens/material3")) {
  throw new Error("root-only consumer installed the Material adapter");
}
if (existsSync("node_modules/@material/material-color-utilities")) {
  throw new Error("root-only consumer installed the Material engine");
}
const rootEntry = readFileSync(new URL(await import.meta.resolve("scheme-tokens")), "utf8");
if (rootEntry.includes("@material") || rootEntry.includes("material3") || rootEntry.includes("@texel")) {
  throw new Error("root import contains optional engine code");
}

function expectOk(result, label) {
  if (!result.ok) {
    throw new Error(label + " failed: " + JSON.stringify(result.issues));
  }
  return result.value;
}
function expectFail(result, code) {
  if (result.ok || !result.issues.some((issue) => issue.code === code)) {
    throw new Error("Expected issue code " + code + ", got " + JSON.stringify(result));
  }
}
function expectThrow(callback, message) {
  try {
    callback();
  } catch (error) {
    if (String(error?.message ?? error).includes(message)) {
      return;
    }
    throw error;
  }
  throw new Error("Expected throw containing: " + message);
}
function expectPackagePathNotExported(callback) {
  try {
    callback();
  } catch (error) {
    if (String(error?.code ?? error?.message ?? error).includes("ERR_PACKAGE_PATH_NOT_EXPORTED")) {
      return;
    }
    throw error;
  }
  throw new Error("Expected package path not exported");
}
`,
  );
}

function writeAdapterConsumer(): void {
  writeJson(join(adapterConsumerDirectory, "package.json"), {
    private: true,
    type: "module",
    dependencies: {
      "scheme-tokens": fileDependencySpec(adapterConsumerDirectory, rootTarball),
      "@scheme-tokens/material3": fileDependencySpec(adapterConsumerDirectory, adapterTarball),
    },
  });
  writeFileSync(
    join(adapterConsumerDirectory, "adapter-audit.mjs"),
    `
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { buildScheme, defineTokenLayer, exportCssVars } from "scheme-tokens";
import { material3 } from "@scheme-tokens/material3";

const require = createRequire(import.meta.url);
const materialOnly = expectOk(buildScheme(material3("#6750a4")), "material3 base build");
if (!("material3.primary" in materialOnly.tokens)) {
  throw new Error("material3 base did not emit Material role tokens");
}

const application = defineTokenLayer({
  id: "application",
  defaultVisibility: "public",
  aliases: {
    "app.background": "material3.surface",
    "app.foreground": "material3.on-surface",
    "app.primary": "material3.primary",
    "app.primary-foreground": "material3.on-primary",
  },
});
const layered = expectOk(
  buildScheme(
    material3(
      "#6750a4",
      { variant: "expressive", extendedColors: [{ name: "success", color: "#2e7d32" }] },
      { defaultVisibility: "internal" },
    ),
    { layers: [application] },
  ),
  "material3 layered build",
);
for (const key of ["app.background", "app.foreground", "app.primary", "app.primary-foreground"]) {
  if (!(key in layered.tokens)) {
    throw new Error("application token missing: " + key);
  }
}
const cssExport = expectOk(exportCssVars(layered), "material3 CSS export");
writeFileSync("material3.css", cssExport.css);
if (
  !cssExport.css.includes("--app--primary:") ||
  cssExport.variableByToken["app.background"] !== "--app--background"
) {
  throw new Error("material3 CSS export did not expose app-owned CSS custom properties");
}

const adapterManifest = require("@scheme-tokens/material3/package.json");
if (adapterManifest.peerDependencies?.["scheme-tokens"] !== "^0.1.0") {
  throw new Error("Material adapter does not declare scheme-tokens as a peer dependency");
}
if (adapterManifest.dependencies?.["scheme-tokens"] !== undefined) {
  throw new Error("Material adapter must not depend on core as a runtime dependency");
}
const rootEntry = readFileSync(new URL(await import.meta.resolve("scheme-tokens")), "utf8");
if (rootEntry.includes("@material") || rootEntry.includes("material3") || rootEntry.includes("@texel")) {
  throw new Error("root import contains optional engine code");
}

function expectOk(result, label) {
  if (!result.ok) {
    throw new Error(label + " failed: " + JSON.stringify(result.issues));
  }
  return result.value;
}
`,
  );
}

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

function fileDependencySpec(fromDirectory: string, tarball: string): string {
  return `file:${relative(fromDirectory, tarball).replaceAll("\\", "/")}`;
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

function nodeWrite(value: string): void {
  process.stdout.write(`${value}\n`);
}
