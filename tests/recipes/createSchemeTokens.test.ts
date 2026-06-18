import { describe, expect, it } from "vitest";
import {
  appSurfaceLayer,
  createSchemeTokens,
  darkMode,
  dynamicSchemeSource,
  hex,
  lightMode,
  literalColor,
  tokenKey,
  type ColorSchemeTokenGraphTransform,
} from "../../src/index";

describe("createSchemeTokens", () => {
  it("works with no aliases, no layers, and no transform", () => {
    const result = createSchemeTokens({
      source: dynamicSchemeSource({ sourceColor: hex("#6750A4") }),
      compile: {
        include: [tokenKey("scheme.primary")],
      },
      css: { prefix: "theme" },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.tokenSet.tokens.map((token) => String(token.key))).toEqual([
      "scheme.primary",
    ]);
    expect(result.value.cssVariables).toContain("--theme-scheme-primary:");
  });

  it("expands aliases into compiled and exported tokens", () => {
    const result = createSchemeTokens({
      source: dynamicSchemeSource({ sourceColor: hex("#6750A4") }),
      aliases: {
        "app.action": "scheme.primary",
        "app.canvas": "scheme.surface",
      },
      compile: {
        include: [tokenKey("app.action"), tokenKey("app.canvas")],
      },
      css: { prefix: "theme" },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.graph.tokens.slice(-2)).toEqual([
      {
        kind: "alias",
        key: tokenKey("app.action"),
        target: tokenKey("scheme.primary"),
      },
      {
        kind: "alias",
        key: tokenKey("app.canvas"),
        target: tokenKey("scheme.surface"),
      },
    ]);
    expect(result.value.tokenSet.tokens.map((token) => String(token.key))).toEqual([
      "app.action",
      "app.canvas",
    ]);
    expect(result.value.cssVariables).toContain("--theme-app-action:");
    expect(result.value.cssVariables).toContain("--theme-app-canvas:");
  });

  it("orchestrates dynamic source, layers, compiler, CSS export, and snapshot serialization", () => {
    const result = createSchemeTokens({
      source: dynamicSchemeSource({ sourceColor: hex("#6750A4") }),
      layers: [appSurfaceLayer],
      compile: {
        include: [tokenKey("chrome.background"), tokenKey("semantic.action.background")],
      },
      css: { prefix: "theme" },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.value.graph.tokens.some((token) => token.key === tokenKey("chrome.background")),
    ).toBe(true);
    expect(result.value.tokenSet.tokens.map((token) => String(token.key))).toEqual([
      "chrome.background",
      "semantic.action.background",
    ]);
    expect(result.value.cssVariables).toContain("--theme-chrome-background:");
    expect(JSON.parse(result.value.snapshot)).toEqual(
      expect.objectContaining({
        schemaVersion: "compiled-color-scheme-tokens/v0",
      }),
    );
  });

  it("applies aliases after layers and before transform", () => {
    const result = createSchemeTokens({
      source: dynamicSchemeSource({ sourceColor: hex("#6750A4") }),
      layers: [appSurfaceLayer],
      aliases: {
        "app.chromeBackground": "chrome.background",
      },
      transform: (graph) => {
        expect(graph.tokens.some((token) => token.key === tokenKey("chrome.background"))).toBe(
          true,
        );
        expect(graph.tokens.some((token) => token.key === tokenKey("app.chromeBackground"))).toBe(
          true,
        );

        return {
          ...graph,
          tokens: [
            ...graph.tokens,
            {
              kind: "alias",
              key: tokenKey("app.primaryAction"),
              target: tokenKey("app.chromeBackground"),
            },
          ],
        };
      },
      compile: {
        include: [tokenKey("app.primaryAction")],
      },
      css: { prefix: "theme" },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.tokenSet.tokens.map((token) => String(token.key))).toEqual([
      "app.primaryAction",
    ]);
    expect(result.value.cssVariables).toContain("--theme-app-primary-action:");
  });

  it("applies singular transform after aliases and before compile", () => {
    const transform: ColorSchemeTokenGraphTransform = (graph) => {
      expect(graph.tokens.at(-1)).toEqual({
        kind: "alias",
        key: tokenKey("app.first"),
        target: tokenKey("scheme.primary"),
      });

      return {
        ...graph,
        tokens: [
          ...graph.tokens,
          { kind: "alias", key: tokenKey("app.second"), target: tokenKey("app.first") },
        ],
      };
    };
    const result = createSchemeTokens({
      source: dynamicSchemeSource({ sourceColor: hex("#6750A4") }),
      aliases: {
        "app.first": "scheme.primary",
      },
      transform,
      compile: {
        include: [tokenKey("app.first"), tokenKey("app.second")],
      },
    });
    const secondResult = createSchemeTokens({
      source: dynamicSchemeSource({ sourceColor: hex("#6750A4") }),
      aliases: {
        "app.first": "scheme.primary",
      },
      transform,
      compile: {
        include: [tokenKey("app.first"), tokenKey("app.second")],
      },
    });

    expect(result.ok).toBe(true);
    expect(secondResult.ok).toBe(true);
    if (!secondResult.ok) return;
    if (!result.ok) return;
    expect(result.value.graph.tokens.slice(-2).map((token) => String(token.key))).toEqual([
      "app.first",
      "app.second",
    ]);
    expect(result.value.snapshot).toBe(secondResult.value.snapshot);
  });

  it("compiles and exports transform-added token nodes", () => {
    const result = createSchemeTokens({
      source: dynamicSchemeSource({ sourceColor: hex("#6750A4") }),
      transform: (graph) => ({
        ...graph,
        tokens: [
          ...graph.tokens,
          {
            kind: "color",
            key: tokenKey("app.staticAccent"),
            values: [
              { mode: lightMode, value: literalColor(hex("#112233")) },
              { mode: darkMode, value: literalColor(hex("#ddeeff")) },
            ],
          },
        ],
      }),
      compile: {
        include: [tokenKey("app.staticAccent")],
      },
      css: { prefix: "theme" },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.tokenSet.tokens[0]?.key).toBe(tokenKey("app.staticAccent"));
    expect(result.value.cssVariables).toContain("--theme-app-static-accent: #112233;");
    expect(result.value.snapshot).toContain('"key": "app.staticAccent"');
  });

  it("validates transform output through the compile path", () => {
    const result = createSchemeTokens({
      source: dynamicSchemeSource({ sourceColor: hex("#6750A4") }),
      transform: (graph) => ({
        ...graph,
        tokens: [
          ...graph.tokens,
          {
            kind: "alias",
            key: tokenKey("app.missing"),
            target: tokenKey("scheme.missing"),
          },
        ],
      }),
    });

    const problems = expectProblems(result);

    expect(problems.some((problem) => problem.kind === "invalid-graph")).toBe(true);
  });

  it("returns structured problems from source failures", () => {
    const result = createSchemeTokens({
      source: dynamicSchemeSource({
        sourceColor: { ...hex("#6750A4"), alpha: 0.2 },
      }),
      layers: [appSurfaceLayer],
    });

    expect(expectProblems(result).some((problem) => problem.kind === "unsupported-alpha")).toBe(
      true,
    );
  });
});

function expectProblems<Value, Problem>(
  result:
    | { readonly ok: true; readonly value: Value }
    | { readonly ok: false; readonly problems: readonly Problem[] },
): readonly Problem[] {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("Expected result to fail.");
  return result.problems;
}
