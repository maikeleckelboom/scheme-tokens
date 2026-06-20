// @ts-nocheck
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { join } from "node:path";

const root = process.cwd();

const manifests = [
  {
    name: "root",
    modulePath: "dist/index.js",
    dtsPath: "dist/index.d.ts",
    runtime: [
      "buildTokenSet",
      "compileTokenGraph",
      "defineTokenFragment",
      "defineTokenGraph",
      "exportCssVariables",
      "formatCssColor",
      "parseColor",
      "parseTokenGraph",
      "serializeTokenSet",
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
      "TokenDefinitionInput",
      "TokenFragmentInput",
      "TokenGraphInput",
      "TokenOrigin",
      "TokenGraphToken",
      "TokenGraph",
      "TokenGraphIssue",
      "TokenSelection",
      "CompileTokenGraphOptions",
      "CompileTokenGraphIssue",
      "CompiledToken",
      "CompiledTokenSet",
      "TokenSource",
      "BuildTokenSetOptions",
      "BuildTokenSetValue",
      "BuildTokenSetIssue",
      "CssScope",
      "CssModeSelectors",
      "ExportCssVariablesOptions",
      "ExportCssVariablesIssue",
    ],
  },
  {
    name: "conversion",
    modulePath: "dist/conversion/index.js",
    dtsPath: "dist/conversion/index.d.ts",
    runtime: ["convertColor", "isColorInGamut", "mapColorToGamut"],
    types: [
      "ColorGamut",
      "GamutMappingMethod",
      "MapColorToGamutOptions",
      "ColorConversionIssue",
      "GamutMappingIssue",
    ],
  },
  {
    name: "material3",
    modulePath: "dist/sources/material3/index.js",
    dtsPath: "dist/sources/material3/index.d.ts",
    runtime: ["material3Source"],
    types: [
      "Material3AlgorithmVariant",
      "Material3SpecVersion",
      "Material3Platform",
      "Material3KeyColors",
      "Material3AlgorithmOptions",
      "Material3GamutMappingOptions",
      "Material3SourceOptions",
      "Material3SourceIssue",
      "Material3TokenKey",
    ],
  },
];

const forbidden = [
  "ParseResult",
  "problems",
  "schemaVersion",
  "compileGraph",
  "compileValidatedGraph",
  "createSchemeTokens",
  "createSourceGraph",
  "validateGraph",
  "applyLayers",
  "srgb255",
  "parseColorInput",
  "parseHexColor",
  "CssVariableOptions",
];

for (const manifest of manifests) {
  const module = await import(pathToFileURL(join(root, manifest.modulePath)).href);
  const runtime = Object.keys(module).sort();
  assertEqual(runtime, manifest.runtime, `${manifest.name} runtime exports`);

  const dts = readFileSync(join(root, manifest.dtsPath), "utf8");
  for (const typeName of manifest.types) {
    if (!new RegExp(`\\b${typeName}\\b`).test(dts)) {
      throw new Error(`${manifest.name} declaration is missing ${typeName}`);
    }
  }
  for (const oldName of forbidden) {
    if (dts.includes(oldName)) {
      throw new Error(`${manifest.name} declaration contains removed name ${oldName}`);
    }
  }
  if (dts.includes("@texel/color") || dts.includes("@material/material-color-utilities")) {
    throw new Error(`${manifest.name} declaration leaks dependency types`);
  }
}

const rootBundle = readFileSync(join(root, "dist/index.js"), "utf8");
if (
  rootBundle.includes("@texel/color") ||
  rootBundle.includes("@material/material-color-utilities")
) {
  throw new Error("Root import graph references optional engine dependencies");
}

function assertEqual(actual, expected, label) {
  const expectedSorted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expectedSorted)) {
    throw new Error(
      `${label} mismatch\nactual: ${actual.join(", ")}\nexpected: ${expectedSorted.join(", ")}`,
    );
  }
}
