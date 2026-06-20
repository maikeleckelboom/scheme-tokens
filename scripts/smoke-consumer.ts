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
import { compileTokenGraph, defineTokenGraph, exportCssVariableBlocks, exportCssVariables } from ${JSON.stringify(manifest.name)};

const graph = defineTokenGraph({
  tokens: {
    background: { value: "#ffffff" },
    foreground: { value: "#111111" },
    primary: { value: "#6750a4" },
    "primary-foreground": { value: "#ffffff" },
  },
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
  ["schemas/token-graph.v1.schema.json", "color-scheme-tokens token graph v1"],
  ["schemas/token-fragment.v1.schema.json", "color-scheme-tokens token fragment v1"],
  ["schemas/compiled-token-set.v1.schema.json", "color-scheme-tokens compiled token set v1"],
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
  buildTokenSet,
  compileTokenGraph,
  defineTokenGraph,
  exportCssVariableBlocks,
  type CssVariableBlock,
  type ColorValue,
  type CompiledTokenSet,
  type ExportCssVariablesOptions,
  type Issue,
  type Result,
  type TokenGraphInput,
} from ${JSON.stringify(manifest.name)};

const graph: TokenGraphInput<"base"> = defineTokenGraph({
  tokens: { "app.background": "#ffffff", "app.foreground": "app.background" },
});
const compiled: Result<CompiledTokenSet, Issue> = compileTokenGraph(graph);
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
const built = buildTokenSet({ sources: [source] });
cssOptions.prefix?.toUpperCase();
legacyCssOptions.prefix?.toUpperCase();
cssBlock?.declarations["--background"]?.toUpperCase();
color.colorSpace.toUpperCase();
if (compiled.ok) compiled.value.defaultMode.toUpperCase();
if (built.ok) built.value.compiled.defaultMode.toUpperCase();
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
if (
  existsSync(join(consumerDirectory, "node_modules", "@color-scheme-tokens", "source-material3"))
) {
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
