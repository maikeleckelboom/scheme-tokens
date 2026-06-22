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
  readonly forbiddenDeclarationText?: readonly string[];
}

const root = process.cwd();
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as PackageManifest;

assertEqual(
  Object.keys(packageJson.exports).sort(),
  [
    ".",
    "./package.json",
    "./schemas/color-token-graph.v1.schema.json",
    "./schemas/color-token-layer.v1.schema.json",
    "./schemas/compiled-color-scheme.v1.schema.json",
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
  `exportCss${"Variables"}`,
  `exportCss${"Variable"}Blocks`,
  `Css${"Variable"}Block`,
  `serialize${"Scheme"}`,
  `Token${"Definition"}AuthoringInput`,
  `Token${"Graph"}AuthoringInput`,
  `Token${"Graph"}Token`,
  `Token${"Graph"}Issue`,
  `Token${"Layer"}AuthoringInput`,
  `Token${"Source"}`,
  `Srgb${"Color"}Input`,
  `DisplayP3${"Color"}Input`,
  `Oklch${"Color"}Input`,
  `Srgb${"Color"}`,
  `DisplayP3${"Color"}`,
  `Oklch${"Color"}`,
  `Color${"Space"}`,
  `Color${"Component"}`,
  `Color${"Input"}`,
  `Color${"Value"}Input`,
  `Color${"Value"}`,
  `Parse${"Color"}Issue`,
  `color${"Spaces"}`,
  `parse${"Color"}`,
  `format${"Css"}${"Color"}`,
  `Base${"Token"}Origin`,
  `Color${"Expression"}`,
  `Color${"Token"}Graph`,
  `Color${"Token"}GraphToken`,
  `semantic${"Tokens"}`,
  `semantic${"Token"}`,
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
      "colorTokenGraphKind",
      "colorTokenLayerKind",
      "compileTokenGraph",
      "compiledColorSchemeKind",
      "createSchemeBuilder",
      "defineTokenGraph",
      "defineTokenLayer",
      "defineTokens",
      "exportCssVars",
      "parseCompiledScheme",
      "parseTokenGraph",
      "parseTokenLayer",
      "serializeCompiledScheme",
      "serializeTokenGraph",
      "serializeTokenLayer",
      "tokenRef",
    ],
    types: [
      "JsonPrimitive",
      "JsonValue",
      "Issue",
      "NonEmptyIssues",
      "Result",
      "TokenVisibility",
      "ReferenceInput",
      "ColorExpressionInput",
      "ColorTokenExpressionInput",
      "ColorTokenDefinitionAuthoringInput",
      "ColorTokenDefinitionInput",
      "ColorTokenGraphAuthoringInput",
      "ColorTokenGraphKind",
      "ColorTokenGraphInput",
      "TokenOrigin",
      "ColorTokenGraphIssue",
      "ColorTokenLayerAuthoringInput",
      "ColorTokenLayerInput",
      "ColorTokenLayerKind",
      "CompiledColorSchemeKind",
      "ModeOf",
      "TokenKeyOf",
      "TokenSelection",
      "CompileTokenGraphOptions",
      "CompileTokenGraphIssue",
      "CompiledColorToken",
      "CompiledColorScheme",
      "ParseCompiledSchemeIssue",
      "ColorTokenSource",
      "BuildSchemeOptions",
      "BuildSchemeSourceOptions",
      "BuildSchemeIssue",
      "SchemeBuilder",
      "SchemeBuilderBuildOptions",
      "SchemeBuilderConfig",
      "CssVarDeclaration",
      "CssVarBlock",
      "CssVarsExport",
      "CssScope",
      "CssModeSelectors",
      "ExportCssVarsOptions",
      "ExportCssVarsIssue",
      "CssVariableNameInput",
    ],
    forbiddenDeclarationText: [
      "@texel/color",
      "@material/material-color-utilities",
      "@scheme-tokens/material3",
      "material3",
      "Material3",
      "css-tree",
    ],
  },
  {
    name: "material3",
    modulePath: "packages/material3/dist/index.js",
    dtsPath: "packages/material3/dist/index.d.ts",
    runtime: [
      "material3",
      "material3Platforms",
      "material3Preset",
      "material3SpecVersions",
      "material3Variants",
    ],
    types: [
      "Material3ExtendedColorInput",
      "Material3GenerationOptions",
      "Material3Input",
      "Material3IntegrationOptions",
      "Material3Issue",
      "Material3PaletteOverridesInput",
      "Material3Platform",
      "Material3Preset",
      "Material3SourceColorsInput",
      "Material3SpecVersion",
      "Material3Variant",
    ],
    forbiddenDeclarationText: ["@material/material-color-utilities", "css-tree"],
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
  assertEqual(extractExportedTypeNames(dts), manifest.types, `${manifest.name} type exports`);
  for (const removedName of removedPublicNames) {
    if (new RegExp(`\\b${removedName}\\b`).test(dts)) {
      throw new Error(`${manifest.name} declaration exposes removed public name: ${removedName}`);
    }
  }
  for (const forbiddenText of manifest.forbiddenDeclarationText ?? []) {
    if (dts.includes(forbiddenText)) {
      throw new Error(`${manifest.name} declaration leaks forbidden text: ${forbiddenText}`);
    }
  }
  if (
    manifest.name === "root" &&
    (dts.includes("invalid-variable-prefix") || !dts.includes("invalid-css-prefix"))
  ) {
    throw new Error(`${manifest.name} declaration exposes a stale CSS prefix issue code`);
  }
  if (/import\(["'][^)]+["']\)\./.test(dts)) {
    throw new Error(`${manifest.name} declaration exposes inline type imports`);
  }
}

const rootBundle = readFileSync(join(root, "dist/index.js"), "utf8");
if (
  rootBundle.includes("@texel/color") ||
  rootBundle.includes("@material/material-color-utilities") ||
  rootBundle.includes("@scheme-tokens/material3") ||
  rootBundle.includes("material3") ||
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

function extractExportedTypeNames(dts: string): readonly string[] {
  const names = new Set<string>();
  for (const match of dts.matchAll(/export\s*\{(?<body>[^}]*)\}/gs)) {
    const body = match.groups?.body;
    if (body === undefined) {
      continue;
    }
    for (const rawPart of body.split(",")) {
      const part = rawPart.trim();
      if (!part.startsWith("type ")) {
        continue;
      }
      names.add(
        part
          .slice("type ".length)
          .split(/\s+as\s+/u)[0]!
          .trim(),
      );
    }
  }
  return [...names].sort();
}

function listFiles(directory: string): readonly string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory()
      ? listFiles(path).map((child) => `${entry}/${child}`)
      : [entry];
  });
}
