import { describe, expect, it } from "vitest";
import { createSchemeTokens, hex, type ColorSchemeTokenLayerInput } from "../../src/index";
import { material3Source } from "../../src/sources/material3";

describe("createSchemeTokens", () => {
  it("works with no aliases and no layers", () => {
    const result = createSchemeTokens({
      source: material3Source({ color: "#6750A4" }),
      compile: {
        include: ["m3.primary"],
      },
      css: { prefix: "theme" },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.tokenSet.tokens.map((token) => String(token.key))).toEqual(["m3.primary"]);
    expect(result.value.cssVariables).toContain("--theme-m3-primary:");
  });

  it("expands aliases from source tokens into compiled and exported app tokens", () => {
    const result = createSchemeTokens({
      source: material3Source({ color: "#6750A4" }),
      aliases: {
        "app.action": "m3.primary",
        "app.canvas": "m3.surface",
      },
      compile: {
        include: ["app.action", "app.canvas"],
      },
      css: { prefix: "theme" },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.graph.tokens.slice(-2)).toEqual([
      {
        kind: "alias",
        key: "app.action",
        target: "m3.primary",
      },
      {
        kind: "alias",
        key: "app.canvas",
        target: "m3.surface",
      },
    ]);
    expect(result.value.tokenSet.tokens.map((token) => String(token.key))).toEqual([
      "app.action",
      "app.canvas",
    ]);
    expect(result.value.cssVariables).toContain("--theme-app-action:");
    expect(result.value.cssVariables).toContain("--theme-app-canvas:");
  });

  it("orchestrates source, layers, compiler, CSS export, and snapshot serialization", () => {
    const result = createSchemeTokens({
      source: material3Source({ color: "#6750A4" }),
      layers: [applicationLayer],
      compile: {
        include: ["app.canvas", "app.action"],
      },
      css: { prefix: "theme" },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.graph.tokens.some((token) => token.key === "app.canvas")).toBe(true);
    expect(result.value.tokenSet.tokens.map((token) => String(token.key))).toEqual([
      "app.canvas",
      "app.action",
    ]);
    expect(result.value.cssVariables).toContain("--theme-app-canvas:");
    expect(JSON.parse(result.value.snapshot)).toEqual(
      expect.objectContaining({
        schemaVersion: "compiled-color-scheme-tokens/v0",
      }),
    );
  });

  it("applies aliases after layers and before compile", () => {
    const result = createSchemeTokens({
      source: material3Source({ color: "#6750A4" }),
      layers: [applicationLayer],
      aliases: {
        "app.chromeBackground": "app.canvas",
      },
      compile: {
        include: ["app.chromeBackground"],
      },
      css: { prefix: "theme" },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.graph.tokens.some((token) => token.key === "app.canvas")).toBe(true);
    expect(result.value.graph.tokens.some((token) => token.key === "app.chromeBackground")).toBe(
      true,
    );
    expect(result.value.tokenSet.tokens.map((token) => String(token.key))).toEqual([
      "app.chromeBackground",
    ]);
    expect(result.value.cssVariables).toContain("--theme-app-chrome-background:");
  });

  it("returns structured problems from source failures", () => {
    const result = createSchemeTokens({
      source: material3Source({
        color: { ...hex("#6750A4"), alpha: 0.2 },
      }),
    });

    expect(expectProblems(result).some((problem) => problem.kind === "unsupported-alpha")).toBe(
      true,
    );
  });

  it("returns structured graph problems for invalid recipe aliases", () => {
    const result = createSchemeTokens({
      source: material3Source({ color: "#6750A4" }),
      aliases: {
        app: "m3.primary",
      },
    });

    expect(expectProblems(result).some((problem) => problem.kind === "invalid-token-key")).toBe(
      true,
    );
  });
});

const applicationLayer: ColorSchemeTokenLayerInput = {
  name: "application",
  tokens: [
    { kind: "alias", key: "app.canvas", target: "m3.surface" },
    { kind: "alias", key: "app.text", target: "m3.onSurface" },
    { kind: "alias", key: "app.action", target: "m3.primary" },
    { kind: "alias", key: "app.actionText", target: "m3.onPrimary" },
  ],
};

function expectProblems<Value, Problem>(
  result:
    | { readonly ok: true; readonly value: Value }
    | { readonly ok: false; readonly problems: readonly Problem[] },
): readonly Problem[] {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("Expected result to fail.");
  return result.problems;
}
