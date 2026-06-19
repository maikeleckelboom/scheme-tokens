import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { createSchemeTokens } from "../../src/index";
import { material3Source } from "../../src/sources/material3";

describe("deterministic Material 3 output", () => {
  it("matches the canonical purple Material 3 token-set and CSS fixtures byte-for-byte", async () => {
    const first = generateFixtureOutput();
    const second = generateFixtureOutput();
    const jsonFixture = await readFile(
      new URL("../fixtures/material3-purple.token-set.snapshot.json", import.meta.url),
      "utf8",
    );
    const cssFixture = await readFile(
      new URL("../fixtures/material3-purple.css", import.meta.url),
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
    expect(first.cssVariables).toContain("--theme-m3-primary: #65558f;");
  });
});

function generateFixtureOutput(): { readonly snapshot: string; readonly cssVariables: string } {
  const result = createSchemeTokens({
    source: material3Source({ color: "#6750A4" }),
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
