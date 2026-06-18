import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
const packageName = packageJson.name;
const pnpmExecPath = process.env.npm_execpath;
const workspace = mkdtempSync(join(tmpdir(), "color-scheme-tokens-smoke-"));
const packDirectory = join(workspace, "pack");
const consumerDirectory = join(workspace, "consumer");

mkdirSync(packDirectory, { recursive: true });
mkdirSync(consumerDirectory, { recursive: true });
const tarballName = runPnpm(["pack", "--pack-destination", packDirectory], repoRoot)
  .trim()
  .split(/\r?\n/)
  .at(-1);

if (!tarballName) {
  throw new Error("Unable to determine packed tarball name.");
}

const tarballPath = join(packDirectory, basename(tarballName));

writeFileSync(
  join(workspace, "README.txt"),
  `Temporary packed-consumer smoke workspace for ${packageName}.\n`,
);
writeFileSync(
  join(consumerDirectory, "package.json"),
  JSON.stringify(
    {
      private: true,
      type: "module",
      dependencies: {
        [packageName]: `file:${tarballPath.replaceAll("\\", "/")}`,
      },
    },
    null,
    2,
  ),
);
writeFileSync(
  join(consumerDirectory, "esm.mjs"),
  `
import { appSurfaceLayer, createSchemeTokens, dynamicSchemeSource, hex } from ${JSON.stringify(packageName)};

const result = createSchemeTokens({
  source: dynamicSchemeSource({ sourceColor: hex("#6750A4") }),
  layers: [appSurfaceLayer],
  css: { prefix: "theme" },
});

if (!result.ok) throw new Error(JSON.stringify(result.problems));
if (!result.value.cssVariables.includes("--theme-chrome-background:")) {
  throw new Error("Missing layered CSS variable from ESM import.");
}
`,
);
writeFileSync(
  join(consumerDirectory, "types.ts"),
  `
import {
  appSurfaceLayer,
  createSchemeGraph,
  createSchemeTokens,
  dynamicSchemeSource,
  hex,
  literalColor,
  type ColorTokenValue,
  type CreateSchemeGraphOptions,
  type DynamicSchemeSourceOptions,
  type DynamicSchemeSourceProblem,
  type DynamicSchemeVariant,
  type LiteralColorValue,
  type Result,
  type SchemeTokensRecipeProblem,
  type SchemeTokensRecipeResult,
} from ${JSON.stringify(packageName)};

const variant: DynamicSchemeVariant = "tonal";
const sourceOptions: DynamicSchemeSourceOptions = {
  sourceColor: hex("#6750A4"),
  variant,
  contrastLevel: 0,
};
const authoredColor = literalColor(hex("#6750A4"));
const typedAuthoredColor: LiteralColorValue = authoredColor;
const graphValue: ColorTokenValue = typedAuthoredColor;
const graphOptions = {
  source: dynamicSchemeSource(sourceOptions),
} satisfies CreateSchemeGraphOptions;
const graphResult = createSchemeGraph(graphOptions);
const result = createSchemeTokens({
  source: dynamicSchemeSource({ sourceColor: hex("#6750A4") }),
  layers: [appSurfaceLayer],
  css: { prefix: "theme" },
});

const typedResult: Result<SchemeTokensRecipeResult, SchemeTokensRecipeProblem> = result;
const readProblemKind = (problem: DynamicSchemeSourceProblem) => problem.kind;
readProblemKind({ kind: "invalid-contrast-level", message: "example" });
variant.toUpperCase();
if (graphResult.ok) {
  graphResult.value.tokens.length;
}
if (result.ok) {
  const value: SchemeTokensRecipeResult = result.value;
  value.cssVariables.includes("--theme-chrome-background:");
}
authoredColor.value.colorSpace.toUpperCase();
graphValue.kind.toUpperCase();
if (!typedResult.ok) {
  typedResult.problems.map((problem) => problem.kind);
}

// @ts-expect-error old authored color factory is intentionally not public.
import(${JSON.stringify(packageName)}).then((module) => module.solidColorIntent);

// @ts-expect-error old authored color value type is intentionally not public.
type OldColorIntent = import(${JSON.stringify(packageName)}).ColorIntent;

// @ts-expect-error old literal color value type is intentionally not public.
type OldSolidColorIntent = import(${JSON.stringify(packageName)}).SolidColorIntent;

// @ts-expect-error source-only createSchemeGraph calls are not public.
createSchemeGraph(dynamicSchemeSource({ sourceColor: hex("#6750A4") }));

// @ts-expect-error specVersion is an internal fixed default, not public configuration.
dynamicSchemeSource({ sourceColor: hex("#6750A4"), specVersion: "2025" });
`,
);
writeFileSync(
  join(consumerDirectory, "tsconfig.json"),
  JSON.stringify(
    {
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
    },
    null,
    2,
  ),
);

runPnpm(["install", "--ignore-scripts"], consumerDirectory);
assertPackedPackageBoundary(join(consumerDirectory, "node_modules", ...packageName.split("/")));
run("node", ["esm.mjs"], consumerDirectory);
run(
  "node",
  [join(repoRoot, "node_modules", "typescript", "bin", "tsc"), "-p", "tsconfig.json"],
  consumerDirectory,
);

function runPnpm(args, cwd) {
  if (pnpmExecPath === undefined) return run("pnpm", args, cwd);
  return run(process.execPath, [pnpmExecPath, ...args], cwd);
}

function run(command, args, cwd) {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
}

function assertPackedPackageBoundary(packageDirectory) {
  const manifest = JSON.parse(readFileSync(join(packageDirectory, "package.json"), "utf8"));
  const cjsArtifacts = listFiles(packageDirectory).filter((filePath) =>
    /\.(?:cjs|cts)(?:\.map)?$/.test(filePath),
  );

  assertNoRequireExportCondition(manifest.exports, "exports");

  if (manifest.main?.endsWith(".cjs")) {
    throw new Error(`Packed package main points to a CJS artifact: ${manifest.main}`);
  }

  if (cjsArtifacts.length > 0) {
    throw new Error(
      `Packed package contains CJS artifacts:\n${cjsArtifacts
        .map((filePath) => `- ${relative(packageDirectory, filePath)}`)
        .join("\n")}`,
    );
  }
}

function assertNoRequireExportCondition(value, path) {
  if (value === null || typeof value !== "object") return;

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (key === "require") {
      throw new Error(`Packed package exposes a require export condition at ${childPath}.`);
    }

    assertNoRequireExportCondition(child, childPath);
  }
}

function listFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return listFiles(path);
    return [path];
  });
}
