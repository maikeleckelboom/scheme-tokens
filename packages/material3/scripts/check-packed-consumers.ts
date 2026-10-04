import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, parse, relative, resolve } from "node:path";
import { repoRoot } from "./api-snapshot.ts";
import { packReleaseCandidate } from "./release-candidate.ts";

const workspace = mkdtempSync(join(tmpdir(), "scheme-tokens-material3-consumers-"));
assertSafeTemporaryRoot(workspace);

try {
  const coreArtifact = process.env.SCHEME_TOKENS_CORE_TARBALL;
  const materialArtifact = process.env.SCHEME_TOKENS_MATERIAL_TARBALL;
  if ((coreArtifact === undefined) !== (materialArtifact === undefined)) {
    throw new Error("Supply both candidate artifacts together.");
  }
  const { coreTarball, adapterTarball, versions } =
    coreArtifact !== undefined && materialArtifact !== undefined
      ? {
          coreTarball: coreArtifact,
          adapterTarball: materialArtifact,
          versions: { core: "0.4.0", adapter: "0.2.0" },
        }
      : packReleaseCandidate(workspace);

  checkCombinedConsumer(coreTarball, adapterTarball);
  checkCoreOnlyConsumer(coreTarball);
  process.stdout.write(
    `Packed release-candidate consumers passed for scheme-tokens@${versions.core} and @scheme-tokens/material3@${versions.adapter}.\n`,
  );
} finally {
  rmSync(workspace, { recursive: true, force: true });
}

function checkCombinedConsumer(coreTarball: string, adapterTarball: string): void {
  const consumer = join(workspace, "combined-consumer");
  mkdirSync(consumer, { recursive: true });
  writeJson(join(consumer, "package.json"), {
    private: true,
    type: "module",
    dependencies: {
      "scheme-tokens": fileDependencySpec(consumer, coreTarball),
      "@scheme-tokens/material3": fileDependencySpec(consumer, adapterTarball),
    },
  });
  writeJson(join(consumer, "tsconfig.json"), {
    compilerOptions: {
      strict: true,
      module: "NodeNext",
      moduleResolution: "NodeNext",
      target: "ES2022",
      lib: ["ES2022"],
      types: [],
      exactOptionalPropertyTypes: true,
      noUncheckedIndexedAccess: true,
      verbatimModuleSyntax: true,
      skipLibCheck: false,
      rootDir: ".",
      outDir: "dist",
    },
    include: ["consumer.ts", "material-coordinates.ts"],
  });
  writeFileSync(join(consumer, "consumer.ts"), combinedConsumerSource());
  copyFileSync(
    join(repoRoot, "examples", "theme-coordinates", "material.ts"),
    join(consumer, "material-coordinates.ts"),
  );
  writeFileSync(join(consumer, "consumer.mjs"), rawNodeConsumerSource());

  freshInstall(consumer);
  run(process.execPath, ["consumer.mjs"], consumer);
  run(
    process.execPath,
    [
      process.env.SCHEME_TOKENS_TSC_PATH ??
        join(repoRoot, "node_modules", "typescript", "bin", "tsc"),
      "-p",
      "tsconfig.json",
    ],
    consumer,
  );
  run(process.execPath, [join("dist", "consumer.js")], consumer);
  run(process.execPath, [join("dist", "material-coordinates.js")], consumer);
  checkMaterialTypeMatrix(consumer);
  process.stdout.write("Paired raw Node ESM and strict NodeNext runtime passed.\n");

  if (existsSync(join(consumer, "node_modules", "@material", "material-color-utilities"))) {
    throw new Error("Packed adapter consumer installed Material Color Utilities separately.");
  }
}

function checkCoreOnlyConsumer(coreTarball: string): void {
  const consumer = join(workspace, "core-only-consumer");
  mkdirSync(consumer, { recursive: true });
  writeJson(join(consumer, "package.json"), {
    private: true,
    type: "module",
    dependencies: { "scheme-tokens": fileDependencySpec(consumer, coreTarball) },
  });
  writeFileSync(
    join(consumer, "consumer.mjs"),
    `import { compileTokenGraph, defineTokenGraph } from "scheme-tokens";\n\n` +
      `const compiled = compileTokenGraph(defineTokenGraph({tokens: { primary: "#6750a4" }}), { selection: "all" });\n` +
      `if (!compiled.ok || compiled.value.tokens.primary.base !== "#6750a4") throw new Error("core-only consumer failed");\n`,
  );
  freshInstall(consumer);
  run(process.execPath, ["consumer.mjs"], consumer);
  if (
    existsSync(join(consumer, "node_modules", "@scheme-tokens", "material3")) ||
    existsSync(join(consumer, "node_modules", "@material", "material-color-utilities"))
  ) {
    throw new Error("Packed core-only consumer installed optional Material packages.");
  }
}

function rawNodeConsumerSource(): string {
  return `
import {
  compileTokenGraph,
  defineTokenGraph,
  exportCssVars,
  tokenRef,
} from "scheme-tokens";
import { material3 } from "@scheme-tokens/material3";

const material = material3("#6750a4");
const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  layers: [material],
  tokens: { "action.primary.background": tokenRef("md.sys.color.primary") },
});
const compiled = compileTokenGraph(graph, { selection: "all" });
if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.issues));
}
if (compiled.value.tokens["md.sys.color.primary"].light !== "#65558f") {
  throw new Error("raw Node ESM Material generation failed");
}
if (compiled.value.tokens["action.primary.background"].dark !== "#cfbdfe") {
  throw new Error("raw Node ESM composition failed");
}
const css = exportCssVars(compiled.value);
if (!css.ok || css.value.variableByToken["md.sys.color.primary"] !== "--md-sys-color-primary") {
  throw new Error("raw Node ESM Material CSS naming failed");
}
`;
}

function combinedConsumerSource(): string {
  return `
import { material3 } from "@scheme-tokens/material3";
import { compileTokenGraph, defineTokenGraph, defineTokenLayer, exportCssVars, orThrow, tokenRef } from "scheme-tokens";

const material = material3("#6750a4", { visibility: "internal", modeSettings: {
  standard: { colorMode: "light" }, inverse: { colorMode: "dark" },
} });
const overrides = defineTokenLayer({ id: "brand-overrides", tokens: { "md.sys.color.primary": "#ff0055" } });
const graph = defineTokenGraph({
  modes: ["inverse", "standard"], defaultMode: "standard", layers: [material, overrides],
  tokens: { "action.primary.background": tokenRef("md.sys.color.primary"), "brand.seed": "#6750a4" },
});
const all = orThrow(compileTokenGraph(graph, { selection: "all" }));
if (all.tokens["md.sys.color.primary"].standard !== "#ff0055") {
  throw new Error("packed override failed");
}
const declarations = all.metadataByToken["md.sys.color.primary"].declarations;
if (JSON.stringify(declarations) !== JSON.stringify([
  { origin: { kind: "layer", id: "material3" } }, { origin: { kind: "layer", id: "brand-overrides" } },
])) {
  throw new Error("packed provenance failed");
}
const publicScheme = orThrow(compileTokenGraph(graph));
if (Object.keys(publicScheme.tokens).length !== 2) {
  throw new Error("packed visibility failed");
}
const css = orThrow(exportCssVars(all, { activation: { selectors: { inverse: ".dark" } } }));
if (css.variableByToken["md.sys.color.primary"] !== "--md-sys-color-primary") {
  throw new Error("packed Material CSS naming failed");
}
if (!css.css.includes(":where(.dark) {\\n  --action-primary-background: ")) {
  throw new Error("packed Material custom condition failed");
}
`;
}

function checkMaterialTypeMatrix(consumer: string): void {
  const cases = readFileSync(
    join(repoRoot, "packages", "material3", "tests", "types", "material3.test.ts"),
    "utf8",
  );
  writeFileSync(join(consumer, "material3.test.ts"), cases);
  const compiler =
    process.env.SCHEME_TOKENS_TSC_PATH ??
    join(repoRoot, "node_modules", "typescript", "bin", "tsc");
  const strictOptions = {
    strict: true,
    module: "NodeNext",
    moduleResolution: "NodeNext",
    target: "ES2022",
    lib: ["ES2022"],
    types: [],
    skipLibCheck: false,
  };
  for (const [label, flags] of [
    ["strict-only", { noEmit: true }],
    [
      "stricter",
      {
        exactOptionalPropertyTypes: true,
        noUncheckedIndexedAccess: true,
        verbatimModuleSyntax: true,
        isolatedModules: true,
        declaration: true,
        emitDeclarationOnly: true,
        outDir: "type-declarations",
        rootDir: ".",
      },
    ],
  ] as const) {
    const config = `tsconfig.material-${label}.json`;
    writeJson(join(consumer, config), {
      compilerOptions: { ...strictOptions, ...flags },
      include: ["material3.test.ts"],
    });
    run(process.execPath, [compiler, "-p", config], consumer);
    if (label === "stricter") {
      readFileSync(join(consumer, "type-declarations", "material3.test.d.ts"));
    }
    process.stdout.write(
      `Packed Material declarations passed: ${label} NodeNext, skipLibCheck=false.\n`,
    );
  }
}

function freshInstall(consumer: string): void {
  runPnpm(
    ["install", "--lockfile-only", "--ignore-scripts", "--strict-peer-dependencies"],
    consumer,
  );
  runPnpm(
    ["install", "--frozen-lockfile", "--ignore-scripts", "--strict-peer-dependencies"],
    consumer,
  );
}

function fileDependencySpec(fromDirectory: string, tarballPath: string): string {
  return `file:${relative(fromDirectory, tarballPath).replaceAll("\\", "/")}`;
}

function runPnpm(
  args: readonly string[],
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const npmExecPath = process.env.npm_execpath;
  return npmExecPath === undefined
    ? run("pnpm", args, cwd, env)
    : run(process.execPath, [npmExecPath, ...args], cwd, env);
}

function run(
  command: string,
  args: readonly string[],
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return execFileSync(command, args, {
    cwd,
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function assertSafeTemporaryRoot(path: string): void {
  const resolved = resolve(path);
  const systemTemp = resolve(tmpdir());
  if (
    dirname(resolved) !== systemTemp ||
    !parse(resolved).base.startsWith("scheme-tokens-material3-consumers-")
  ) {
    throw new Error(`Refusing to use unexpected temporary directory: ${resolved}`);
  }
}
