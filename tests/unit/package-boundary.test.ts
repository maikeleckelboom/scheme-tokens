import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import * as root from "../../src";

const repoRoot = process.cwd();

describe("package boundary", () => {
  test("root package metadata is publishable without scoped access metadata", () => {
    const manifest = readManifest();

    expect(manifest.version).toBe("0.1.0");
    expect(manifest.private).toBeUndefined();
    expect(manifest.publishConfig).toBeUndefined();
  });

  test("root runtime exports are exact", () => {
    expect(Object.keys(root).sort()).toEqual([
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
    ]);
    expect(root).not.toHaveProperty(`defineToken${"Frag"}${"ment"}`);
  });

  test("package exports expose only root, schemas, and package metadata", () => {
    const manifest = readManifest();
    expect(Object.keys(manifest.exports).sort()).toEqual([
      ".",
      "./package.json",
      "./schemas/compiled-scheme.v1.schema.json",
      "./schemas/token-graph.v1.schema.json",
      "./schemas/token-layer.v1.schema.json",
    ]);
  });

  test("core package has no Material or optional-engine dependency graph", () => {
    const manifest = readManifest();
    expect(manifest.dependencies ?? {}).toEqual({});
    expect(manifest.peerDependencies ?? {}).toEqual({});
    expect(manifest.optionalDependencies ?? {}).toEqual({});
    expect(JSON.stringify(manifest)).not.toContain("@material/material-color-utilities");
    expect(JSON.stringify(manifest)).not.toContain("@texel/color");
    expect(JSON.stringify(manifest)).not.toContain("css-tree");
  });

  test("root source tree does not contain engine-backed adapter paths, imports, or Material contracts", () => {
    expect(existsSync(join(repoRoot, "src", "conversion"))).toBe(false);
    expect(existsSync(join(repoRoot, "src", "sources", "material3"))).toBe(false);

    const sourceText = listFiles(join(repoRoot, "src"))
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");
    expect(sourceText).not.toContain("@material/material-color-utilities");
    expect(sourceText).not.toContain("@scheme-tokens/source-material3");
    expect(sourceText).not.toContain("material3Source");
    expect(sourceText).not.toContain("Material3SourceInput");
    expect(sourceText).not.toContain("MATERIAL3_ROLE");
    expect(sourceText).not.toContain("extendedColors");
    expect(sourceText).not.toContain("customColors");
    expect(sourceText).not.toContain("harmonize");
    expect(sourceText).not.toContain("blend");
    expect(sourceText).not.toContain("keyColors");
    expect(sourceText).not.toContain("@texel/color");
    expect(sourceText).not.toContain("css-tree");
  });
});

interface PackageManifest {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly optionalDependencies?: Readonly<Record<string, string>>;
  readonly peerDependencies?: Readonly<Record<string, string>>;
  readonly exports: Readonly<Record<string, unknown>>;
  readonly private?: boolean;
  readonly publishConfig?: unknown;
  readonly version: string;
}

function readManifest(): PackageManifest {
  return JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as PackageManifest;
}

function listFiles(directory: string): readonly string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}
