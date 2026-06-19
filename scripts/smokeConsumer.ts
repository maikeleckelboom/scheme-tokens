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
import { createSchemeTokens } from ${JSON.stringify(packageName)};
import { material3Source } from ${JSON.stringify(`${packageName}/sources/material3`)};

const result = createSchemeTokens({
  source: material3Source({ color: "#6750A4" }),
  aliases: {
    "app.action": "m3.primary",
    "app.actionText": "m3.onPrimary",
    "app.canvas": "m3.surface",
    "app.text": "m3.onSurface",
  },
  css: { prefix: "theme" },
});

if (!result.ok) throw new Error(JSON.stringify(result.problems));
if (!result.value.cssVariables.includes("--theme-app-action:")) {
  throw new Error("Missing aliased CSS variable from ESM import.");
}
`,
);
writeFileSync(
  join(consumerDirectory, "types.ts"),
  `
import {
  createSchemeTokens,
  createSourceGraph,
  hex,
  literalColor,
  parseColorInput,
  type ColorInput,
  type ColorSchemeTokenGraph,
  type ColorTokenValue,
  type ColorSchemeTokenSource,
  type ColorSchemeTokenSourceProblem,
  type CreateSourceGraphOptions,
  type LiteralColorValue,
  type Result,
  type SchemeTokensRecipeProblem,
  type SchemeTokensRecipeResult,
} from ${JSON.stringify(packageName)};
import {
  material3Source,
  type Material3AlgorithmVariant,
  type Material3SourceOptions,
  type Material3SourceProblem,
} from ${JSON.stringify(`${packageName}/sources/material3`)};

const variant: Material3AlgorithmVariant = "tonalSpot";
const colorInput: ColorInput = "#6750A4";
const sourceOptions: Material3SourceOptions = {
  color: colorInput,
  keyColors: {
    primary: "#6750A4",
  },
  algorithm: {
    variant,
    contrastLevel: 0,
    specVersion: "2021",
    platform: "phone",
  },
};
const authoredColor = literalColor(hex("#6750A4"));
const typedAuthoredColor: LiteralColorValue = authoredColor;
const graphValue: ColorTokenValue = typedAuthoredColor;
const graphOptions = {
  source: material3Source(sourceOptions),
} satisfies CreateSourceGraphOptions;
const source: ColorSchemeTokenSource<Material3SourceProblem> = graphOptions.source;
const graphResult = createSourceGraph(graphOptions);
const result = createSchemeTokens({
  source: material3Source({ color: "#6750A4" }),
  aliases: {
    "app.action": "m3.primary",
    "app.actionText": "m3.onPrimary",
    "app.canvas": "m3.surface",
    "app.text": "m3.onSurface",
  },
  css: { prefix: "theme" },
});
type RecipeOptions = Parameters<typeof createSchemeTokens>[0];
const legacyTransformOptions = {
  source: material3Source({ color: "#6750A4" }),
  // @ts-expect-error the public transform hook is removed from v1.
  transform: (graph: ColorSchemeTokenGraph) => graph,
} satisfies RecipeOptions;

const typedResult: Result<SchemeTokensRecipeResult, SchemeTokensRecipeProblem> = result;
const readProblemKind = (problem: ColorSchemeTokenSourceProblem | Material3SourceProblem) =>
  problem.kind;
readProblemKind({ kind: "invalid-contrast-level", message: "example" });
source.id.toUpperCase();
variant.toUpperCase();
if (graphResult.ok) {
  graphResult.value.tokens.length;
}
if (result.ok) {
  const value: SchemeTokensRecipeResult = result.value;
  value.cssVariables.includes("--theme-app-action:");
}
parseColorInput(colorInput).ok.valueOf();
authoredColor.value.colorSpace.toUpperCase();
graphValue.kind.toUpperCase();
legacyTransformOptions.source.id.toUpperCase();
if (!typedResult.ok) {
  typedResult.problems.map((problem) => problem.kind);
}

// @ts-expect-error Material 3 source factory is intentionally not exported from root.
import(${JSON.stringify(packageName)}).then((module) => module.material3Source);

// @ts-expect-error Material 3 option types are intentionally not exported from root.
type RootMaterial3SourceOptions = import(${JSON.stringify(packageName)}).Material3SourceOptions;

// @ts-expect-error the public transform hook is removed from v1.
type RootColorSchemeTokenGraphTransform = import(${JSON.stringify(packageName)}).ColorSchemeTokenGraphTransform;

// @ts-expect-error source-only createSourceGraph calls are not public.
createSourceGraph(material3Source({ color: "#6750A4" }));

// @ts-expect-error Material algorithm knobs do not belong to generic recipe options.
createSchemeTokens({ source: material3Source({ color: "#6750A4" }), specVersion: "2025" });

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
