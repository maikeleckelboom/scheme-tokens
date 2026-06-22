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
import { compileTokenGraph, defineTokenGraph, defineTokens, exportCssVars, parseCompiledScheme, serializeCompiledScheme, tokenRef } from ${JSON.stringify(manifest.name)};

const graph = defineTokens({
  background: {
    base: "#ffffff",
    dark: "#111111",
  },
  foreground: {
    base: "#111111",
    dark: "#ffffff",
  },
});
const compiled = compileTokenGraph(graph);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.issues));
if (compiled.scheme.tokens.background.base !== "#ffffff") throw new Error("direct token read failed");
if (compiled.scheme.tokens.background.dark !== "#111111") throw new Error("direct dark token read failed");
if ("valueByMode" in compiled.scheme.tokens.background) throw new Error("compiled token exposed valueByMode");

const cssExport = exportCssVars(compiled.scheme);
if (!cssExport.ok || !cssExport.css.includes("--background: #ffffff;")) throw new Error("root workflow failed");
if (cssExport.value !== undefined) throw new Error("CSS export exposed a generic value field");
if (cssExport.variableByToken.background !== "--background") throw new Error("CSS custom-property lookup failed");

const appGraph = defineTokenGraph({
  tokens: {
    "brand.primary": {
      value: "#6750a4",
      visibility: "internal",
    },
    primary: tokenRef("brand.primary"),
    literal: "brand.primary",
  },
});
const appCompiled = compileTokenGraph(appGraph);
if (!appCompiled.ok) throw new Error(JSON.stringify(appCompiled.issues));
if (!("primary" in appCompiled.scheme.tokens) || "brand.primary" in appCompiled.scheme.tokens) {
  throw new Error("public selection failed");
}
if (appCompiled.scheme.tokens.literal.base !== "brand.primary") {
  throw new Error("bare strings must not be inferred as references");
}

const parsedCompiled = parseCompiledScheme(JSON.parse(serializeCompiledScheme(compiled.scheme)));
if (!parsedCompiled.ok || parsedCompiled.scheme.kind !== "scheme-tokens/compiled-scheme") {
  throw new Error("compiled parse boundary failed");
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
  compileTokenGraph,
  defineTokenGraph,
  defineTokens,
  exportCssVars,
  tokenRef,
  type CompiledScheme,
  type CssVarBlock,
  type CssVarsExport,
  type ExportCssVarsOptions,
  type TokenGraphInput,
  type TokenKeyOf,
  type ModeOf,
} from ${JSON.stringify(manifest.name)};

const graph: TokenGraphInput<"base"> = defineTokenGraph({
  tokens: {
    "app.background": {
      value: "#ffffff",
      visibility: "internal",
    },
    "app.foreground": tokenRef("app.background"),
  },
});
const simple = defineTokens({
  background: {
    light: "#ffffff",
    dark: "#111111",
  },
}, {
  modes: ["light", "dark"],
  defaultMode: "light",
});
const compiled = compileTokenGraph(simple);
const cssOptions: ExportCssVarsOptions = { prefix: "theme" };
const legacyCssOptions: ExportCssVarsOptions = {
  // @ts-expect-error variablePrefix is not part of the public CSS export options.
  variablePrefix: "theme",
};
const tokenKey: TokenKeyOf<typeof graph> = "app.background";
const mode: ModeOf<typeof simple> = "light";
const cssExport = exportCssVars({} as never);
if (cssExport.ok) {
  const cssVarsExport: CssVarsExport = cssExport;
  const cssBlock: CssVarBlock | undefined = cssExport.blocks[0];
  cssVarsExport.css.toUpperCase();
  cssBlock?.declarations[0]?.value.toUpperCase();
}
if (compiled.ok) {
  const scheme: CompiledScheme<"background", "dark" | "light"> = compiled.scheme;
  scheme.tokens.background.dark.toUpperCase();
  // @ts-expect-error compile success does not expose value.
  compiled.value.defaultMode.toUpperCase();
}
cssOptions.prefix?.toUpperCase();
legacyCssOptions.prefix?.toUpperCase();
tokenKey.toUpperCase();
mode.toUpperCase();
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
  throw new Error("core-only consumer unexpectedly installed the Material package");
}
const rootJs = readFileSync(join(installedRoot, "dist", "index.js"), "utf8");
if (
  rootJs.includes("@texel/color") ||
  rootJs.includes("@material/material-color-utilities") ||
  rootJs.includes("css-tree") ||
  rootJs.includes("material3")
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
