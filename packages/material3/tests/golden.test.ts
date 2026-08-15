import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { material3, type Material3TokenKey } from "../src";
import { canonicalJson, generateGoldenFixtures, goldenCoordinates } from "./engine-evidence";

const fixtureDirectory = fileURLToPath(new URL("./fixtures/", import.meta.url));
const writeFixtures = process.env.MATERIAL3_WRITE_FIXTURES === "1";

describe("Material 3 golden vectors", () => {
  const fixtures = generateGoldenFixtures();

  test.each(goldenCoordinates)("reproduces $fileName", (coordinate) => {
    const generated = requireFixture(fixtures, coordinate.fileName);
    const serialized = canonicalJson(generated);
    const fixturePath = new URL(`./fixtures/${coordinate.fileName}`, import.meta.url);
    if (writeFixtures) {
      mkdirSync(fixtureDirectory, { recursive: true });
      writeFileSync(fixturePath, serialized);
    }
    expect(serialized).toBe(readFileSync(fixturePath, "utf8").replaceAll("\r\n", "\n"));

    const fragment = material3(coordinate.seed, {
      specVersion: coordinate.specVersion,
      variant: coordinate.variant,
      contrastLevel: coordinate.contrastLevel,
    });
    const generatedTokens = (generated as GoldenFixture).tokens;
    for (const [key, values] of Object.entries(generatedTokens)) {
      const tokenValue = fragment.layers[0].tokens[key as Material3TokenKey]?.value;
      expect(tokenValue).toEqual(values);
    }
  });

  test("keeps the isolated spec transition at 87 of 96 values", () => {
    const baseline = requireFixture(fixtures, goldenCoordinates[0].fileName) as GoldenFixture;
    const transition = requireFixture(fixtures, goldenCoordinates[1].fileName) as GoldenFixture;
    let differences = 0;
    for (const key of Object.keys(baseline.tokens)) {
      for (const appearance of ["light", "dark"] as const) {
        if (baseline.tokens[key]?.[appearance] !== transition.tokens[key]?.[appearance]) {
          differences += 1;
        }
      }
    }
    expect(differences).toBe(87);
  });
});

interface GoldenFixture {
  readonly tokens: Readonly<Record<string, Readonly<Record<"light" | "dark", string>>>>;
}

function requireFixture(fixtures: ReadonlyMap<string, unknown>, name: string): unknown {
  const fixture = fixtures.get(name);
  if (fixture === undefined) {
    throw new Error(`Missing generated fixture: ${name}`);
  }
  return fixture;
}
