// @ts-nocheck
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
const workspace = mkdtempSync(join(tmpdir(), "color-scheme-tokens-smoke-"));
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
import { compileTokenGraph, defineTokenGraph, exportCssVariables } from ${JSON.stringify(manifest.name)};

const graph = defineTokenGraph({
  formatVersion: 1,
  modes: ["base"],
  defaultMode: "base",
  defaultVisibility: "public",
  tokens: {
    "app.background": { value: "#ffffff" },
  },
});
const compiled = compileTokenGraph(graph);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.issues));
const css = exportCssVariables(compiled.value);
if (!css.ok || !css.value.includes("--app--background")) throw new Error("root workflow failed");
`,
);
writeFileSync(
  join(consumerDirectory, "conversion.mjs"),
  `
import { parseColor } from ${JSON.stringify(manifest.name)};
import { convertColor } from ${JSON.stringify(`${manifest.name}/conversion`)};
const parsed = parseColor("color(display-p3 1 0.22 0.08)");
if (!parsed.ok) throw new Error("parse failed");
const converted = convertColor(parsed.value, "srgb");
if (!converted.ok) throw new Error(JSON.stringify(converted.issues));
`,
);
writeFileSync(
  join(consumerDirectory, "material.mjs"),
  `
import { buildTokenSet } from ${JSON.stringify(manifest.name)};
import { material3Source } from ${JSON.stringify(`${manifest.name}/sources/material3`)};
const built = buildTokenSet({ source: material3Source({ sourceColor: "#6750a4" }), selection: { keys: ["m3.primary"] } });
if (!built.ok) throw new Error(JSON.stringify(built.issues));
`,
);
writeFileSync(
  join(consumerDirectory, "types.ts"),
  `
import {
  buildTokenSet,
  compileTokenGraph,
  defineTokenGraph,
  type ColorValue,
  type CompiledTokenSet,
  type ExportCssVariablesOptions,
  type Issue,
  type Result,
  type TokenGraphInput,
} from ${JSON.stringify(manifest.name)};
import {
  convertColor,
  type ColorGamut,
  type GamutMappingMethod,
} from ${JSON.stringify(`${manifest.name}/conversion`)};
import {
  material3Source,
  type Material3SourceOptions,
  type Material3TokenKey,
} from ${JSON.stringify(`${manifest.name}/sources/material3`)};

const graph: TokenGraphInput<"base"> = defineTokenGraph({
  formatVersion: 1,
  modes: ["base"],
  defaultMode: "base",
  defaultVisibility: "public",
  tokens: { "app.background": { value: "#ffffff" } },
});
const compiled: Result<CompiledTokenSet, Issue> = compileTokenGraph(graph);
const cssOptions: ExportCssVariablesOptions = { variablePrefix: "theme" };
const gamut: ColorGamut = "srgb";
const method: GamutMappingMethod = "preserve-lightness";
const color: ColorValue = { colorSpace: "srgb", r: 1, g: 1, b: 1, alpha: 1 };
convertColor(color, gamut);
const options: Material3SourceOptions = { sourceColor: "#6750a4" };
const key: Material3TokenKey = "m3.primary";
buildTokenSet({ source: material3Source(options), selection: { keys: [key] } });
cssOptions.variablePrefix?.toUpperCase();
method.toUpperCase();
if (compiled.ok) compiled.value.defaultMode.toUpperCase();
`,
);

runPnpm(["install", "--ignore-scripts"], consumerDirectory);
for (const script of ["root.mjs", "conversion.mjs", "material.mjs"])
  run("node", [script], consumerDirectory);
run(
  "node",
  [join(repoRoot, "node_modules", "typescript", "bin", "tsc"), "-p", "tsconfig.json"],
  consumerDirectory,
);

const installedRoot = join(consumerDirectory, "node_modules", manifest.name);
const rootJs = readFileSync(join(installedRoot, "dist", "index.js"), "utf8");
if (rootJs.includes("@texel/color") || rootJs.includes("@material/material-color-utilities")) {
  throw new Error("Packed root entry loads optional engines");
}

function pack(destination) {
  const output = runPnpm(["pack", "--pack-destination", destination], repoRoot)
    .trim()
    .split(/\r?\n/)
    .at(-1);
  if (output === undefined) throw new Error("Unable to determine packed tarball name");
  return join(destination, basename(output));
}

function runPnpm(args, cwd) {
  const npmExecPath = process.env.npm_execpath;
  return npmExecPath === undefined
    ? run("pnpm", args, cwd)
    : run(process.execPath, [npmExecPath, ...args], cwd);
}

function run(command, args, cwd) {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
