import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("source policy", () => {
  it("keeps the public index explicit and free of legacy wrapper exports", async () => {
    const index = await readFile("src/index.ts", "utf8");
    const forbidden = [
      "createTheme",
      "createScheme",
      "createColorScheme",
      "createCssVariables",
      "createCssVarMap",
      "MaterialTheme",
      "DynamicColorScheme",
      "PaletteStyle",
      "exportJsonTokens",
      "solidColorIntent",
      "ColorIntent",
      "SolidColorIntent",
    ];

    expect(index).not.toMatch(/export\s+\*/);
    for (const name of forbidden) {
      expect(index).not.toMatch(new RegExp(`\\b${name}\\b`));
    }
  });

  it("keeps internal dynamic source mechanics out of the root type surface", async () => {
    const index = await readFile("src/index.ts", "utf8");
    const internalTypes = [
      "ColorTokenValueProblem",
      "DynamicSchemePlatform",
      "DynamicSchemeResolvedOptions",
      "DynamicSchemeSource",
      "DynamicSchemeSpecVersion",
      "SchemeTokensRecipeRun",
    ];

    for (const name of internalTypes) {
      expect(index).not.toMatch(new RegExp(`\\b${name}\\b`));
    }
  });

  it("keeps the package ESM-only and pins deterministic upstream color generation", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
      readonly type?: string;
      readonly main?: string;
      readonly module?: string;
      readonly exports?: Record<string, unknown>;
      readonly dependencies?: Record<string, string>;
    };
    const rootExport = packageJson.exports?.["."] as Record<string, unknown> | undefined;
    const tsupConfig = await readFile("tsup.config.ts", "utf8");

    expect(packageJson.type).toBe("module");
    expect(packageJson.main).toBe("./dist/index.js");
    expect(packageJson.module).toBeUndefined();
    expect(rootExport).toEqual({
      types: "./dist/index.d.ts",
      import: "./dist/index.js",
    });
    expect(JSON.stringify(packageJson.exports)).not.toContain('"require"');
    expect(tsupConfig).not.toContain('"cjs"');
    expect(packageJson.dependencies?.["@material/material-color-utilities"]).toBe("0.4.0");
  });

  it("does not use deprecated upstream dynamic-color APIs", async () => {
    const source = await readSourceFiles("src");

    expect(source).not.toMatch(/import\s*\{[^}]*\bScheme\b[^}]*\}/);
    expect(source).not.toMatch(
      /\bScheme\.(light|dark|lightContent|darkContent|lightFromCorePalette|darkFromCorePalette)\b/,
    );
    expect(source).not.toMatch(/\bMaterialDynamicColors\./);
    expect(source).not.toContain("themeFromSourceColor");
    expect(source).not.toContain("applyTheme");
  });

  it("keeps Material-specific imports out of generic graph, recipe, layer, and export modules", async () => {
    const genericSource = (
      await Promise.all(
        ["src/core", "src/exporters", "src/layers", "src/recipes"].map((directory) =>
          readSourceFiles(directory),
        ),
      )
    ).join("\n");

    expect(genericSource).not.toContain("@material/material-color-utilities");
    expect(genericSource).not.toMatch(/\bMaterial[A-Z]/);
  });
});

async function readSourceFiles(directory: string): Promise<string> {
  const entries = await readdir(directory, { withFileTypes: true });
  const contents = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return readSourceFiles(path);
      if (!entry.name.endsWith(".ts")) return "";
      return readFile(path, "utf8");
    }),
  );

  return contents.join("\n");
}
