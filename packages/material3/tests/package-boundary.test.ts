import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import * as adapter from "../src";
import {
  excludedEngineRoles,
  material3HelperMethods,
  material3RoleDefinitions,
} from "../src/role-catalog";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));

describe("adapter package boundary", () => {
  test("publishes the exact ESM package shape", () => {
    const manifest = readManifest();
    expect(manifest.name).toBe("@scheme-tokens/material3");
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u);
    expect(manifest.private).toBeUndefined();
    expect(manifest.publishConfig).toEqual({ access: "public" });
    expect(manifest.type).toBe("module");
    expect(manifest.sideEffects).toBe(false);
    expect(manifest.engines).toEqual({ node: ">=24" });
    expect(manifest.license).toBe("MIT AND Apache-2.0");
    expect(Object.keys(manifest.exports).sort()).toEqual([".", "./package.json"]);
    expect(manifest.files).toEqual([
      "dist",
      "README.md",
      "LICENSE",
      "LICENSE-MATERIAL-COLOR-UTILITIES",
      "THIRD_PARTY_NOTICES.md",
    ]);
  });

  test("has one runtime export", () => {
    expect(Object.keys(adapter)).toEqual(["material3"]);
  });

  test("bundles only the exact engine and keeps core as the shared peer", () => {
    const manifest = readManifest();
    expect(manifest.dependencies ?? {}).toEqual({});
    expect(manifest.optionalDependencies ?? {}).toEqual({});
    expect(manifest.peerDependencies).toEqual({
      "scheme-tokens": "^0.2.0 || ^0.3.0",
    });
    expect(manifest.devDependencies["scheme-tokens"]).toBe("workspace:*");
    expect(manifest.devDependencies["@material/material-color-utilities"]).toBe("0.4.0");
  });

  test("keeps one 48-role production catalog and all explicit exclusions", () => {
    expect(material3RoleDefinitions).toHaveLength(48);
    expect(new Set(material3RoleDefinitions.map((definition) => definition.tokenKey)).size).toBe(
      48,
    );
    expect(Object.keys(excludedEngineRoles)).toEqual([
      "primaryPaletteKeyColor",
      "secondaryPaletteKeyColor",
      "tertiaryPaletteKeyColor",
      "neutralPaletteKeyColor",
      "neutralVariantPaletteKeyColor",
      "errorPaletteKeyColor",
      "primaryDim",
      "secondaryDim",
      "tertiaryDim",
      "errorDim",
      "surfaceTint",
    ]);
    expect(material3HelperMethods).toEqual(["highestSurface"]);
  });

  test("ships both license texts and the upstream notice", () => {
    expect(readFileSync(join(packageRoot, "LICENSE"), "utf8")).toContain(
      "Copyright (c) 2026 Maikel Eckelboom",
    );
    expect(readFileSync(join(packageRoot, "LICENSE-MATERIAL-COLOR-UTILITIES"), "utf8")).toContain(
      "Apache License",
    );
    const notice = readFileSync(join(packageRoot, "THIRD_PARTY_NOTICES.md"), "utf8");
    expect(notice).toContain("Material Color Utilities version 0.4.0");
    expect(notice).toContain("material-foundation/material-color-utilities");
  });
});

interface PackageManifest {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies: Readonly<Record<string, string>>;
  readonly engines: Readonly<Record<string, string>>;
  readonly exports: Readonly<Record<string, unknown>>;
  readonly files: readonly string[];
  readonly license: string;
  readonly name: string;
  readonly optionalDependencies?: Readonly<Record<string, string>>;
  readonly peerDependencies: Readonly<Record<string, string>>;
  readonly private?: boolean;
  readonly publishConfig?: unknown;
  readonly sideEffects: boolean;
  readonly type: string;
  readonly version: string;
}

function readManifest(): PackageManifest {
  return JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as PackageManifest;
}
