import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("source policy", () => {
  it("keeps the public index explicit and source-agnostic", async () => {
    const index = await readFile("src/index.ts", "utf8");

    expect(index).not.toMatch(/export\s+\*/);
    expect(index).not.toMatch(/\bMaterial3\b/);
    expect(index).not.toContain("material3");
    expect(index).not.toContain("@material/material-color-utilities");
    expect(index).not.toContain("./sources/material3");
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
    const material3Export = packageJson.exports?.["./sources/material3"] as
      | Record<string, unknown>
      | undefined;
    const tsupConfig = await readFile("tsup.config.ts", "utf8");

    expect(packageJson.type).toBe("module");
    expect(packageJson.main).toBe("./dist/index.js");
    expect(packageJson.module).toBeUndefined();
    expect(rootExport).toEqual({
      types: "./dist/index.d.ts",
      import: "./dist/index.js",
    });
    expect(material3Export).toEqual({
      types: "./dist/sources/material3/index.d.ts",
      import: "./dist/sources/material3/index.js",
    });
    expect(JSON.stringify(packageJson.exports)).not.toContain('"require"');
    expect(tsupConfig).not.toContain('"cjs"');
    expect(packageJson.dependencies?.["@material/material-color-utilities"]).toBe("0.4.0");
  });

  it("keeps Material-specific imports out of generic graph, recipe, layer, and export modules", async () => {
    const genericSource = (
      await Promise.all(
        ["src/core", "src/exporters", "src/layers", "src/recipes"].map((directory) =>
          readSourceFiles(directory),
        ),
      )
    ).join("\n");
    const rootIndex = await readFile("src/index.ts", "utf8");

    expect(genericSource).not.toContain("@material/material-color-utilities");
    expect(genericSource).not.toContain("src/sources/material3");
    expect(genericSource).not.toContain("../sources/material3");
    expect(rootIndex).not.toContain("@material/material-color-utilities");
    expect(rootIndex).not.toContain("src/sources/material3");
    expect(rootIndex).not.toContain("./sources/material3");
    expect(genericSource).not.toMatch(/\bMaterial[A-Z]/);
  });

  it("keeps the deterministic serializer independent from DTCG interop shape", async () => {
    const serializer = await readFile("src/core/serializeTokenSet.ts", "utf8");

    expect(serializer).not.toMatch(/\bDTCG\b/i);
    expect(serializer).not.toContain("$value");
    expect(serializer).not.toContain("$type");
    expect(serializer).not.toContain("$extensions");
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
