import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

type ExportTarget = string | Readonly<Record<string, string>>;

interface PackageManifest {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly exports: Readonly<Record<string, ExportTarget>>;
}

const root = process.cwd();
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as PackageManifest;

const expectedRuntimeExports = [
  "compileTokenGraph",
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
] as const;

const expectedTypeExports = [
  "CompileTokenGraphIssue",
  "CompileTokenGraphOptions",
  "CompiledScheme",
  "CompiledToken",
  "CompiledTokenMetadata",
  "CssModeSelectors",
  "CssScope",
  "CssVarBlock",
  "CssVarDeclaration",
  "CssVarsExport",
  "ExportCssVarsIssue",
  "ExportCssVarsOptions",
  "Issue",
  "JsonValue",
  "ParseCompiledSchemeIssue",
  "Result",
  "TokenDefinition",
  "TokenExpression",
  "TokenGraph",
  "TokenGraphIssue",
  "TokenLayer",
  "TokenOrigin",
  "TokenReference",
  "TokenSelection",
  "TokenVisibility",
] as const;

const removedPublicNames = [
  "CompileTokenGraphResult",
  "CompiledSchemeKind",
  "ExportCssVarsResult",
  "FailureResult",
  "ModeOf",
  "NonEmptyIssues",
  "ParseCompiledSchemeResult",
  "ParseTokenGraphResult",
  "ParseTokenLayerResult",
  "ReferenceInput",
  "TokenDefinitionAuthoringInput",
  "TokenGraphInput",
  "TokenGraphKind",
  "TokenKeyOf",
  "TokenLayerInput",
  "TokenLayerKind",
  "compiledSchemeKind",
  "tokenGraphKind",
  "tokenLayerKind",
] as const;

// This approves the normalized bundled declaration, including overloads and every
// transitively exposed helper type. Update it only after intentionally reviewing
// the generated declaration diff.
const expectedDeclarationContractSha256 =
  "9d42a319b9be12533388dd3b5aac82d4ba6ef4d82923c13c7961855f78f8f0e9";

assertEqual(
  Object.keys(packageJson.exports),
  [
    ".",
    "./package.json",
    "./schemas/compiled-scheme.v1.schema.json",
    "./schemas/token-graph.v1.schema.json",
    "./schemas/token-layer.v1.schema.json",
  ],
  "package exports",
);

if (Object.keys(packageJson.dependencies ?? {}).length > 0) {
  throw new Error("The core package must not declare runtime dependencies");
}

assertEqual(
  listFiles(join(root, "dist")),
  ["index.d.ts", "index.js", "index.js.map"],
  "dist files",
);
assertExportTargetsExist(packageJson.exports);

const rootModule = (await import(pathToFileURL(join(root, "dist/index.js")).href)) as Record<
  string,
  unknown
>;
assertEqual(Object.keys(rootModule), expectedRuntimeExports, "root runtime exports");

const declaration = readFileSync(join(root, "dist/index.d.ts"), "utf8");
const declarationExports = extractDeclarationExports(declaration);
assertEqual(declarationExports.runtime, expectedRuntimeExports, "declaration runtime exports");
assertEqual(declarationExports.types, expectedTypeExports, "declaration type exports");

for (const removedName of removedPublicNames) {
  if (
    declarationExports.runtime.includes(removedName) ||
    declarationExports.types.includes(removedName)
  ) {
    throw new Error(`Root declaration exports removed public name: ${removedName}`);
  }
}

const normalizedDeclaration = normalizeDeclaration(declaration);
assertDeclarationContracts(normalizedDeclaration);
const declarationHash = createHash("sha256").update(normalizedDeclaration).digest("hex");
if (declarationHash !== expectedDeclarationContractSha256) {
  throw new Error(
    `Declaration contract hash mismatch\nactual: ${declarationHash}\nexpected: ${expectedDeclarationContractSha256}`,
  );
}

for (const forbiddenText of [
  "@texel/color",
  "@material/material-color-utilities",
  "@scheme-tokens/material3",
  "css-tree",
]) {
  if (declaration.includes(forbiddenText)) {
    throw new Error(`Root declaration leaks forbidden dependency text: ${forbiddenText}`);
  }
}
if (/import\(["'][^)]+["']\)\./.test(declaration)) {
  throw new Error("Root declaration exposes an inline dependency type import");
}

const rootBundle = readFileSync(join(root, "dist/index.js"), "utf8");
for (const forbiddenText of [
  "@texel/color",
  "@material/material-color-utilities",
  "@scheme-tokens/material3",
  "material3",
  "Material3",
  "css-tree",
]) {
  if (rootBundle.includes(forbiddenText)) {
    throw new Error(`Root import graph references forbidden engine text: ${forbiddenText}`);
  }
}

function assertDeclarationContracts(normalized: string): void {
  const requiredFragments = [
    "type Result<Value, Problem = Issue> = { readonly ok: true; readonly value: Value; } | FailureResult<Problem>;",
    "interface TokenReference<Key extends string = string> { readonly ref: Key; }",
    "readonly value: TokenExpression<Key> | TokenModeValues<Mode, Key>;",
    "declare function parseTokenGraph(input: unknown): Result<TokenGraph, TokenGraphIssue>;",
    "declare function parseTokenLayer(input: unknown): Result<TokenLayer, TokenGraphIssue>;",
    "declare function parseCompiledScheme(input: unknown): Result<CompiledScheme<string, string, false>, ParseCompiledSchemeIssue>;",
    "readonly variableName?: (input: CssVariableNameInput<Key>) => string;",
  ] as const;

  for (const fragment of requiredFragments) {
    if (!normalized.includes(fragment)) {
      throw new Error(`Declaration contract is missing required signature fragment: ${fragment}`);
    }
  }

  for (const forbiddenFragment of [
    "readonly graph:",
    "readonly layer:",
    "readonly scheme:",
    "readonly valueByMode:",
    "readonly aliases:",
  ]) {
    if (normalized.includes(forbiddenFragment)) {
      throw new Error(`Declaration contract contains removed shape: ${forbiddenFragment}`);
    }
  }

  if (/type TokenDefinition<[\s\S]*?readonly value\?:/.test(normalized)) {
    throw new Error("Strict TokenDefinition.value must be required");
  }
}

function assertEqual(
  actualInput: readonly string[],
  expectedInput: readonly string[],
  label: string,
): void {
  const actual = [...actualInput].sort();
  const expected = [...expectedInput].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${label} mismatch\nactual: ${actual.join(", ")}\nexpected: ${expected.join(", ")}`,
    );
  }
}

function assertExportTargetsExist(exports: Readonly<Record<string, ExportTarget>>): void {
  for (const [subpath, target] of Object.entries(exports)) {
    if (typeof target === "string") {
      assertPackagePathExists(target, subpath);
      continue;
    }
    for (const [condition, conditionTarget] of Object.entries(target)) {
      assertPackagePathExists(conditionTarget, `${subpath} ${condition}`);
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

interface DeclarationExports {
  readonly runtime: readonly string[];
  readonly types: readonly string[];
}

function extractDeclarationExports(input: string): DeclarationExports {
  const runtime = new Set<string>();
  const types = new Set<string>();
  for (const match of input.matchAll(/export\s*\{(?<body>[^}]*)\}/gs)) {
    for (const rawPart of match.groups?.body?.split(",") ?? []) {
      const part = rawPart.trim();
      if (part.length === 0) {
        continue;
      }
      const typeOnly = part.startsWith("type ");
      const withoutType = typeOnly ? part.slice("type ".length).trim() : part;
      const exportedName = withoutType
        .split(/\s+as\s+/u)
        .at(-1)
        ?.trim();
      if (exportedName !== undefined) {
        (typeOnly ? types : runtime).add(exportedName);
      }
    }
  }
  return { runtime: [...runtime], types: [...types] };
}

function normalizeDeclaration(input: string): string {
  return input
    .replaceAll("\r\n", "\n")
    .split("\n")
    .filter(
      (line) =>
        !line.startsWith("//#region") &&
        !line.startsWith("//#endregion") &&
        !line.startsWith("//# sourceMappingURL="),
    )
    .join("\n")
    .replace(/\s+/gu, " ")
    .trim();
}

function listFiles(directory: string): readonly string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory()
      ? listFiles(path).map((child) => `${entry}/${child}`)
      : [entry];
  });
}
