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

const rootTarball = pack(repoRoot, packDirectory);

writeJson(join(consumerDirectory, "package.json"), {
  private: true,
  type: "module",
  dependencies: {
    "scheme-tokens": fileDependencySpec(consumerDirectory, rootTarball),
  },
});
writeFileSync(
  join(consumerDirectory, "audit.mjs"),
  `
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import {
  compileTokenGraph,
  defineTokenGraph,
  defineTokens,
  exportCssVars,
  parseCompiledScheme,
  parseTokenGraph,
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
if (!("background" in compiled.tokens) || compiled.tokens.background.dark !== "oklch(0.18 0.02 285)") {
  throw new Error("root compile did not preserve public token mode maps");
}
const cssExport = expectOk(exportCssVars(compiled), "export root CSS");
if (!cssExport.css.includes(":root {") || !cssExport.css.includes(':root[data-scheme="dark"] {')) {
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
if (parsedCompiled.kind !== "scheme-tokens/compiled-scheme") {
  throw new Error("compiled artifact kind was not preserved");
}

const refGraph = defineTokens({
  "brand.primary": "#6750a4",
  primary: tokenRef("brand.primary"),
  literal: "brand.primary",
});
const refCompiled = expectOk(compileTokenGraph(refGraph, { selection: "all" }), "tokenRef compile");
if (refCompiled.tokens.literal.base !== "brand.primary") {
  throw new Error("bare strings were inferred as references");
}
const aliasGraph = defineTokenGraph({
  tokens: {
    "brand.primary": "#6750a4",
  },
  aliases: {
    primary: "brand.primary",
  },
});
expectOk(compileTokenGraph(aliasGraph, { selection: "all" }), "aliases field compile");

const persistedGraph = {
  kind: "scheme-tokens/token-graph",
  formatVersion: 1,
  modes: ["base"],
  defaultMode: "base",
  defaultVisibility: "public",
  tokens: {
    primary: {
      value: "#6750a4",
      extensions: { owner: "audit", nested: { stable: true } },
    },
  },
};
const parsedGraph = expectOk(parseTokenGraph(persistedGraph), "parse strict graph");
if (parsedGraph.tokens.primary.extensions?.nested?.stable !== true) {
  throw new Error("opaque extensions were not preserved");
}
expectFail(parseTokenGraph({ tokens: { primary: "#6750a4" } }), "missing-property");
expectFail(
  parseTokenGraph({
    ...persistedGraph,
    tokens: { primary: { value: { colorSpace: "srgb", components: [1, 1, 1], alpha: 1 } } },
  }),
  "invalid-token-value",
);

for (const subpath of [
  "schemas/token-graph.v1.schema.json",
  "schemas/token-layer.v1.schema.json",
  "schemas/compiled-scheme.v1.schema.json",
]) {
  const schema = require("scheme-tokens/" + subpath);
  if (schema.$schema !== "https://json-schema.org/draft/2020-12/schema") {
    throw new Error("schema did not load from packed subpath: " + subpath);
  }
}
for (const oldSubpath of [
  "schemas/color-token-graph.v1.schema.json",
  "schemas/color-token-layer.v1.schema.json",
  "schemas/compiled-color-scheme.v1.schema.json",
]) {
  expectPackagePathNotExported(() => require("scheme-tokens/" + oldSubpath));
}

if (existsSync("node_modules/@scheme-tokens/material3")) {
  throw new Error("root-only consumer installed the Material package");
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
  return result.scheme ?? result.graph ?? result.layer ?? result;
}
function expectFail(result, code) {
  if (result.ok || !result.issues.some((issue) => issue.code === code)) {
    throw new Error("Expected issue code " + code + ", got " + JSON.stringify(result));
  }
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

runPnpm(["install", "--ignore-scripts"], consumerDirectory);
run("node", ["audit.mjs"], consumerDirectory);

process.stdout.write(
  `${JSON.stringify(
    {
      workspace,
      consumerDirectory,
      rootTarball,
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
