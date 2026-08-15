import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { buildSnapshot, packageRoot, snapshotLabel, snapshotPath } from "./api-snapshot.ts";

const expectedRuntimeExports = ["material3"] as const;
const expectedTypeExports = [
  "Material3Appearance",
  "Material3GraphFragment",
  "Material3SpecVersion",
  "Material3TokenKey",
  "Material3Variant",
] as const;
const forbiddenDeclarationNames = [
  "@material/material-color-utilities",
  "DynamicScheme",
  "Hct",
  "Material3Config",
  "Material3ModeOptions",
  "Material3Options",
  "MaterialDynamicColors",
  "TonalPalette",
] as const;

const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
  readonly exports: Readonly<Record<string, unknown>>;
};
assertEqual(Object.keys(manifest.exports), [".", "./package.json"], "package exports");
assertEqual(
  listFiles(join(packageRoot, "dist")),
  ["index.d.ts", "index.js", "index.js.map"],
  "dist files",
);

const rootModule = (await import(
  pathToFileURL(join(packageRoot, "dist", "index.js")).href
)) as Record<string, unknown>;
assertEqual(Object.keys(rootModule), expectedRuntimeExports, "runtime exports");

const declaration = readFileSync(join(packageRoot, "dist", "index.d.ts"), "utf8");
const declarationExports = extractDeclarationExports(declaration);
assertEqual(declarationExports.runtime, expectedRuntimeExports, "declaration runtime exports");
assertEqual(declarationExports.types, expectedTypeExports, "declaration type exports");
for (const forbidden of forbiddenDeclarationNames) {
  if (declaration.includes(forbidden)) {
    throw new Error(`Adapter declaration leaks forbidden public dependency or type: ${forbidden}`);
  }
}
const normalizedDeclaration = declaration.replace(/\s+/gu, " ");
for (const required of [
  'type Material3Appearance = "light" | "dark";',
  'type Material3SpecVersion = "2021" | "2025";',
  "readonly layers: readonly [TokenLayer<Material3TokenKey>];",
  "declare function material3<const Mode extends string>",
  "declare function material3<const Extra extends string = never>",
]) {
  if (!normalizedDeclaration.includes(required)) {
    throw new Error(`Adapter declaration is missing contract fragment: ${required}`);
  }
}
if (normalizedDeclaration.includes("TokenLayer<Material3TokenKey, Mode>")) {
  throw new Error("Adapter declaration incorrectly attaches the graph mode to TokenLayer");
}

if (!existsSync(snapshotPath)) {
  throw new Error(`Missing API snapshot: ${snapshotLabel}. Run pnpm api:snapshot.`);
}
const expectedSnapshot = buildSnapshot(declaration);
const actualSnapshot = readFileSync(snapshotPath, "utf8").replaceAll("\r\n", "\n");
if (actualSnapshot !== expectedSnapshot) {
  throw new Error(`${snapshotLabel} does not match dist/index.d.ts. Run pnpm api:snapshot.`);
}

const bundle = readFileSync(join(packageRoot, "dist", "index.js"), "utf8");
if (!/from\s+["']scheme-tokens["']/u.test(bundle)) {
  throw new Error("Adapter bundle must externalize scheme-tokens");
}
if (/(?:from\s+|import\s*\()["']@material\/material-color-utilities(?:["'/])/u.test(bundle)) {
  throw new Error("Adapter bundle retains an unresolved Material Color Utilities import");
}
assertShippedSourceMapsResolve();

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

function assertShippedSourceMapsResolve(): void {
  for (const file of ["index.js", "index.d.ts"]) {
    const text = readFileSync(join(packageRoot, "dist", file), "utf8");
    for (const match of text.matchAll(/\/\/# sourceMappingURL=(?<target>\S+)/gu)) {
      const target = match.groups?.target;
      if (target !== undefined && !existsSync(join(packageRoot, "dist", target))) {
        throw new Error(`dist/${file} references an unshipped source map: ${target}`);
      }
    }
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

function listFiles(directory: string): readonly string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory()
      ? listFiles(path).map((child) => `${entry}/${child}`)
      : [entry];
  });
}
