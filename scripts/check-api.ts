import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

type ExportTarget = string | Readonly<Record<string, string>>;

interface PackageManifest {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly exports: Readonly<Record<string, ExportTarget>>;
}

interface ApiManifest {
  readonly name: string;
  readonly modulePath: string;
  readonly dtsPath: string;
  readonly runtime: readonly string[];
  readonly types: readonly string[];
}

const root = process.cwd();
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as PackageManifest;

assertEqual(
  Object.keys(packageJson.exports).sort(),
  [
    ".",
    "./package.json",
    "./schemas/compiled-scheme.v1.schema.json",
    "./schemas/token-graph.v1.schema.json",
    "./schemas/token-layer.v1.schema.json",
  ],
  "package exports",
);

if ("dependencies" in packageJson && Object.keys(packageJson.dependencies).length > 0) {
  throw new Error("The core package must not declare runtime dependencies");
}

const removedRootPackageName = `color-${"scheme"}-tokens`;
const removedAdapterScope = `@color-${"scheme"}-tokens`;
const removedPublicNames = [
  `build${"Token"}${"Set"}`,
  `serialize${"Token"}${"Set"}`,
  `Compiled${"Token"}${"Set"}`,
  `Build${"Token"}${"Set"}Options`,
  `Build${"Token"}${"Set"}Value`,
  `Build${"Token"}${"Set"}Issue`,
] as const;

if (JSON.stringify(packageJson).includes(removedRootPackageName)) {
  throw new Error("The core package manifest exposes the removed package name");
}
if (JSON.stringify(packageJson).includes(removedAdapterScope)) {
  throw new Error("The core package manifest exposes the removed adapter scope");
}

assertEqual(
  listFiles(join(root, "dist")),
  ["index.d.ts", "index.js", "index.js.map"],
  "dist files",
);
assertExportTargetsExist(packageJson.exports);

const manifests: readonly ApiManifest[] = [
  {
    name: "root",
    modulePath: "dist/index.js",
    dtsPath: "dist/index.d.ts",
    runtime: [
      "buildScheme",
      "compileTokenGraph",
      "defineTokenGraph",
      "defineTokenLayer",
      "exportCssVariableBlocks",
      "exportCssVariables",
      "formatCssColor",
      "parseColor",
      "parseTokenGraph",
      "serializeScheme",
    ],
    types: [
      "JsonPrimitive",
      "JsonValue",
      "Issue",
      "NonEmptyIssues",
      "Result",
      "ColorSpace",
      "ColorInput",
      "ColorValue",
      "SrgbColorInput",
      "DisplayP3ColorInput",
      "OklchColorInput",
      "SrgbColor",
      "DisplayP3Color",
      "OklchColor",
      "ParseColorIssue",
      "TokenVisibility",
      "ReferenceInput",
      "ColorExpressionInput",
      "ColorExpression",
      "TokenDefinitionAuthoringInput",
      "TokenDefinitionInput",
      "TokenGraphAuthoringInput",
      "TokenGraphInput",
      "TokenOrigin",
      "TokenGraphToken",
      "TokenGraph",
      "TokenGraphIssue",
      "TokenLayerAuthoringInput",
      "TokenLayerInput",
      "TokenSelection",
      "CompileTokenGraphOptions",
      "CompileTokenGraphIssue",
      "CompiledToken",
      "CompiledScheme",
      "TokenSource",
      "BuildSchemeOptions",
      "BuildSchemeValue",
      "BuildSchemeIssue",
      "CssVariableBlock",
      "CssScope",
      "CssModeSelectors",
      "ExportCssVariablesOptions",
      "ExportCssVariablesIssue",
    ],
  },
];

for (const manifest of manifests) {
  const module = (await import(pathToFileURL(join(root, manifest.modulePath)).href)) as Record<
    string,
    unknown
  >;
  const runtime = Object.keys(module).sort();
  assertEqual(runtime, manifest.runtime, `${manifest.name} runtime exports`);
  for (const removedName of removedPublicNames) {
    if (runtime.includes(removedName)) {
      throw new Error(`${manifest.name} runtime exposes removed public name: ${removedName}`);
    }
  }

  const dts = readFileSync(join(root, manifest.dtsPath), "utf8");
  for (const typeName of manifest.types) {
    if (!new RegExp(`\\b${typeName}\\b`).test(dts)) {
      throw new Error(`${manifest.name} declaration is missing ${typeName}`);
    }
  }
  for (const removedName of removedPublicNames) {
    if (new RegExp(`\\b${removedName}\\b`).test(dts)) {
      throw new Error(`${manifest.name} declaration exposes removed public name: ${removedName}`);
    }
  }
  if (
    dts.includes("@texel/color") ||
    dts.includes("@material/material-color-utilities") ||
    dts.includes("@scheme-tokens/source-material3") ||
    dts.includes("material3Source") ||
    dts.includes("Material3") ||
    dts.includes("css-tree")
  ) {
    throw new Error(`${manifest.name} declaration leaks dependency types`);
  }
  if (dts.includes("invalid-variable-prefix") || !dts.includes("invalid-css-prefix")) {
    throw new Error(`${manifest.name} declaration exposes a stale CSS prefix issue code`);
  }
}

const rootBundle = readFileSync(join(root, "dist/index.js"), "utf8");
if (
  rootBundle.includes("@texel/color") ||
  rootBundle.includes("@material/material-color-utilities") ||
  rootBundle.includes("@scheme-tokens/source-material3") ||
  rootBundle.includes("material3Source") ||
  rootBundle.includes("Material3") ||
  rootBundle.includes("css-tree")
) {
  throw new Error("Root import graph references optional engine dependencies");
}

function assertEqual(actual: readonly string[], expected: readonly string[], label: string): void {
  const expectedSorted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expectedSorted)) {
    throw new Error(
      `${label} mismatch\nactual: ${actual.join(", ")}\nexpected: ${expectedSorted.join(", ")}`,
    );
  }
}

function assertExportTargetsExist(exports: Readonly<Record<string, ExportTarget>>): void {
  for (const [subpath, target] of Object.entries(exports)) {
    if (typeof target === "string") {
      assertPackagePathExists(target, subpath);
      continue;
    }
    if (target !== null && typeof target === "object") {
      for (const [condition, conditionTarget] of Object.entries(target)) {
        if (typeof conditionTarget === "string") {
          assertPackagePathExists(conditionTarget, `${subpath} ${condition}`);
        }
      }
    }
  }
}

function assertPackagePathExists(packagePath: string, label: string): void {
  if (!packagePath.startsWith("./")) {
    throw new Error(`${label} points outside the package: ${packagePath}`);
  }
  if (!existsSync(join(root, packagePath))) {
    throw new Error(`${label} points to a missing file: ${packagePath}`);
  }
}

function listFiles(directory: string): readonly string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory()
      ? listFiles(path).map((child) => `${entry}/${child}`)
      : [entry];
  });
}
