import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { appSurfaceLayer, createSchemeTokens, dynamicSchemeSource, hex } from "../../src/index";

describe("deterministic dynamic output", () => {
  it("matches the canonical purple token-set and CSS fixtures byte-for-byte", async () => {
    const first = generateFixtureOutput();
    const second = generateFixtureOutput();
    const jsonFixture = await readFile(
      new URL("../fixtures/dynamic-purple.token-set.snapshot.json", import.meta.url),
      "utf8",
    );
    const cssFixture = await readFile(
      new URL("../fixtures/dynamic-purple.css", import.meta.url),
      "utf8",
    );

    expect(first).toEqual(second);
    expect(JSON.parse(jsonFixture)).toEqual(
      expect.objectContaining({
        schemaVersion: "compiled-color-scheme-tokens/v0",
      }),
    );
    expect(first.snapshot).toBe(jsonFixture);
    expect(first.cssVariables).toBe(cssFixture);
    expect(first.cssVariables).toContain("--theme-chrome-background: #fdf7ff;");
  });
});

function generateFixtureOutput(): { readonly snapshot: string; readonly cssVariables: string } {
  const result = createSchemeTokens({
    source: dynamicSchemeSource({ sourceColor: hex("#6750A4") }),
    layers: [appSurfaceLayer],
    css: { prefix: "theme" },
  });

  if (!result.ok) {
    throw new Error(JSON.stringify(result.problems, null, 2));
  }

  return {
    snapshot: result.value.snapshot,
    cssVariables: result.value.cssVariables,
  };
}
