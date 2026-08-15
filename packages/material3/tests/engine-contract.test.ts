import { createRequire } from "node:module";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, parse } from "node:path";
import { describe, expect, test } from "vitest";
import {
  canonicalJson,
  certifyHardPaths,
  classifyRoleSurface,
  expectedEngineVersion,
  generateCapabilityMatrix,
  verifyHctBranchBoundaries,
} from "./engine-evidence";

const capabilityFixture = new URL(
  "./fixtures/material3-0.4.0-capability-matrix.json",
  import.meta.url,
);
const writeFixtures = process.env.MATERIAL3_WRITE_FIXTURES === "1";

describe("pinned Material engine contract", () => {
  test("uses exactly Material Color Utilities 0.4.0", () => {
    expect(readInstalledVersion("@material/material-color-utilities")).toBe(expectedEngineVersion);
  });

  test("classifies the complete current instance role surface", () => {
    const surface = classifyRoleSurface();
    expect(surface.acceptedRoleCount).toBe(48);
    expect(surface.excludedRoleCount).toBe(11);
    expect(surface.classifiedRoleMethodCount).toBe(59);
    expect(surface.helperMethods).toEqual(["highestSurface"]);
    expect(surface.unknownPrototypeMethods).toEqual([]);
    expect(surface.unclassifiedRoleMethods).toEqual([]);
  });

  test("certifies the pinned HCT branch boundaries and derived hard paths", () => {
    expect(verifyHctBranchBoundaries().yellow.probes.map((probe) => probe.result)).toEqual([
      false,
      true,
      true,
      false,
    ]);
    const branches = certifyHardPaths();
    expect(branches.yellow.derivedHues).toEqual({
      light: 112.26236398709452,
      dark: 112.26236398709452,
    });
    expect(branches.cyan.derivedHues).toEqual({
      light: 187.66649302382956,
      dark: 187.66649302382956,
    });
  });

  test("reproduces the broad requested-2021/requested-2025 capability matrix", () => {
    const serialized = canonicalJson(generateCapabilityMatrix());
    if (writeFixtures) {
      writeFileSync(capabilityFixture, serialized);
    }
    expect(serialized).toBe(readFileSync(capabilityFixture, "utf8").replaceAll("\r\n", "\n"));
  });
});

function readInstalledVersion(packageName: string): string {
  const require = createRequire(import.meta.url);
  let current = dirname(require.resolve(packageName));
  const root = parse(current).root;
  while (current !== root) {
    const candidate = join(current, "package.json");
    if (existsSync(candidate)) {
      const manifest = JSON.parse(readFileSync(candidate, "utf8")) as {
        readonly name?: string;
        readonly version?: string;
      };
      if (manifest.name === packageName && typeof manifest.version === "string") {
        return manifest.version;
      }
    }
    current = dirname(current);
  }
  throw new Error(`Unable to locate installed manifest for ${packageName}.`);
}
