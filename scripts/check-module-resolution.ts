import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative } from "node:path";
import { repoRoot } from "./api-snapshot.ts";

/**
 * A published package resolves differently for a bundler than it does for Node,
 * and `exports` maps break one without breaking the other. This installs the
 * real tarball into a scratch project and reads every one of the five export
 * keys under both resolution modes, so a subpath that only resolves in one of
 * them fails here instead of in a consumer's editor.
 */
const exportKeys = [
  "scheme-tokens",
  "scheme-tokens/schemas/token-graph.v1.schema.json",
  "scheme-tokens/schemas/token-layer.v1.schema.json",
  "scheme-tokens/schemas/compiled-scheme.v1.schema.json",
  "scheme-tokens/package.json",
] as const;

const consumerSource = `
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
} from "scheme-tokens";
import type { CompiledScheme, CssVarsExport, Result, TokenGraph } from "scheme-tokens";
import tokenGraphSchema from "scheme-tokens/schemas/token-graph.v1.schema.json" with { type: "json" };
import tokenLayerSchema from "scheme-tokens/schemas/token-layer.v1.schema.json" with { type: "json" };
import compiledSchemeSchema from "scheme-tokens/schemas/compiled-scheme.v1.schema.json" with { type: "json" };
import manifest from "scheme-tokens/package.json" with { type: "json" };

const graph: TokenGraph<"brand.600" | "primary", "base"> = defineTokens({
  "brand.600": { value: "#6750a4", visibility: "internal" },
  primary: tokenRef("brand.600"),
});

const compiled: Result<CompiledScheme<"brand.600" | "primary", "base", false>> =
  compileTokenGraph(graph);
if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.issues));
}
if (compiled.value.tokens.primary?.base !== "#6750a4") {
  throw new Error("root export resolution produced the wrong compiled value");
}

const exported: Result<CssVarsExport<"brand.600" | "primary", "base", false>> = exportCssVars(
  compiled.value,
);
if (!exported.ok || !exported.value.css.includes("--primary: #6750a4;")) {
  throw new Error("root export resolution produced the wrong CSS");
}

const layer = defineTokenLayer({ id: "brand", tokens: { primary: "#ff3b30" } });
const layered = compileTokenGraph(
  defineTokenGraph({ tokens: { primary: "#6750a4" }, layers: [layer] }),
);
if (!layered.ok || layered.value.tokens.primary?.base !== "#ff3b30") {
  throw new Error("layer composition failed through the packed entry point");
}

if (
  !parseTokenGraph(JSON.parse(serializeTokenGraph(graph))).ok ||
  !parseTokenLayer(JSON.parse(serializeTokenLayer(layer))).ok ||
  !parseCompiledScheme(JSON.parse(serializeCompiledScheme(compiled.value))).ok
) {
  throw new Error("packed parse/serialize round trip failed");
}

for (const [schema, title] of [
  [tokenGraphSchema, "scheme-tokens token graph v1"],
  [tokenLayerSchema, "scheme-tokens token layer v1"],
  [compiledSchemeSchema, "scheme-tokens compiled scheme v1"],
] as const) {
  if (schema.title !== title) {
    throw new Error("packed schema subpath resolved to the wrong document: " + title);
  }
}

if (manifest.name !== "scheme-tokens") {
  throw new Error("packed package.json subpath resolved to the wrong manifest");
}
`;

interface ResolutionMode {
  readonly name: string;
  readonly module: string;
  readonly moduleResolution: string;
  /** Only Node can execute the emitted output; a bundler profile is typechecked. */
  readonly run: boolean;
}

// `module: "node16"` predates import attributes, and Node's ESM loader requires
// them for the three JSON subpaths, so the Node profile pairs node16 resolution
// with the lowest `module` setting that can express the imports consumers must
// actually write.
const modes: readonly ResolutionMode[] = [
  { name: "bundler", module: "preserve", moduleResolution: "bundler", run: false },
  { name: "node16", module: "node18", moduleResolution: "node16", run: true },
];

const workspace = mkdtempSync(join(tmpdir(), "scheme-tokens-resolution-"));
const packDirectory = join(workspace, "pack");
const consumerDirectory = join(workspace, "consumer");
mkdirSync(packDirectory, { recursive: true });
mkdirSync(consumerDirectory, { recursive: true });

const tarball = pack(packDirectory);
writeJson(join(consumerDirectory, "package.json"), {
  private: true,
  type: "module",
  dependencies: {
    "scheme-tokens": `file:${relative(consumerDirectory, tarball).replaceAll("\\", "/")}`,
  },
});
writeFileSync(join(consumerDirectory, "consumer.ts"), consumerSource);
runPnpm(["install", "--ignore-scripts"], consumerDirectory);

for (const mode of modes) {
  const outDir = `dist-${mode.name}`;
  writeJson(join(consumerDirectory, `tsconfig.${mode.name}.json`), {
    compilerOptions: {
      strict: true,
      skipLibCheck: false,
      module: mode.module,
      moduleResolution: mode.moduleResolution,
      target: "ES2022",
      lib: ["ES2022"],
      types: [],
      resolveJsonModule: true,
      verbatimModuleSyntax: true,
      rootDir: ".",
      outDir,
      noEmit: !mode.run,
    },
    include: ["consumer.ts"],
  });

  run(
    process.execPath,
    [
      join(repoRoot, "node_modules", "typescript", "bin", "tsc"),
      "-p",
      `tsconfig.${mode.name}.json`,
    ],
    consumerDirectory,
  );
  process.stdout.write(`typechecked ${exportKeys.length} export keys under ${mode.name}\n`);

  if (mode.run) {
    run(process.execPath, [join(outDir, "consumer.js")], consumerDirectory);
    process.stdout.write(`executed the packed consumer under ${mode.name}\n`);
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
