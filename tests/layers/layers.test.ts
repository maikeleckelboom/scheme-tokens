import { describe, expect, it } from "vitest";
import {
  compileGraph,
  darkMode,
  hex,
  lightMode,
  literalColor,
  tokenKey,
  validateGraph,
  type ColorSchemeTokenLayer,
  type ColorSchemeTokenGraph,
  type TokenNode,
} from "../../src/index";
import { applyLayers } from "../../src/layers/applyLayers";
import { appSurfaceLayer } from "../../src/layers/appSurfaceLayer";

describe("token layers", () => {
  it("adds the exact app surface aliases without mutating the original graph", () => {
    const graph = baseGraph();
    const layered = applyLayers(graph, [appSurfaceLayer]);

    expect(graph.tokens).toHaveLength(7);
    expect(layered.tokens).toHaveLength(14);
    expect(appSurfaceLayer.tokens.map((token) => String(token.key))).toEqual([
      "chrome.background",
      "chrome.foreground",
      "chrome.border",
      "semantic.action.background",
      "semantic.action.foreground",
      "semantic.danger.background",
      "semantic.danger.foreground",
    ]);
    expect(validateGraph(layered).ok).toBe(true);
  });

  it("is chainable and leaves duplicate token keys for graph validation to reject", () => {
    const graph = baseGraph();
    const firstLayer: ColorSchemeTokenLayer = {
      name: "first",
      tokens: [
        { kind: "alias", key: tokenKey("chrome.background"), target: tokenKey("scheme.surface") },
      ],
    };
    const secondLayer: ColorSchemeTokenLayer = {
      name: "second",
      tokens: [
        { kind: "alias", key: tokenKey("chrome.background"), target: tokenKey("scheme.primary") },
      ],
    };

    const problems = expectProblems(
      validateGraph(applyLayers(applyLayers(graph, [firstLayer]), [secondLayer])),
    );

    expect(problems.some((problem) => problem.kind === "duplicate-token-key")).toBe(true);
  });

  it("rejects unknown alias targets during graph validation", () => {
    const graph = applyLayers(baseGraph(), [
      {
        name: "unknown-target",
        tokens: [
          {
            kind: "alias",
            key: tokenKey("chrome.background"),
            target: tokenKey("scheme.missing"),
          },
        ],
      },
    ]);

    const problems = expectProblems(validateGraph(graph));

    expect(problems.some((problem) => problem.kind === "unknown-alias-target")).toBe(true);
  });

  it("supports mode-specific alias targets", () => {
    const graph = applyLayers(baseGraph(), [
      {
        name: "mode-alias",
        tokens: [
          {
            kind: "alias",
            key: tokenKey("chrome.background"),
            target: [
              { mode: lightMode, value: tokenKey("scheme.surface") },
              { mode: darkMode, value: tokenKey("scheme.primary") },
            ],
          },
        ],
      },
    ]);
    const compiled = compileGraph(graph, { include: [tokenKey("chrome.background")] });

    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    expect(compiled.value.tokens).toHaveLength(1);
    expect(compiled.value.tokens[0]?.values.map((entry) => entry.value)).toEqual([
      hex("#ffffff"),
      hex("#d0bcff"),
    ]);
  });

  it("supports authored color tokens with color token value payloads", () => {
    const graph = applyLayers(baseGraph(), [
      {
        name: "authored-color",
        tokens: [
          {
            kind: "color",
            key: tokenKey("semantic.notice.background"),
            values: [
              { mode: lightMode, value: literalColor(hex("#fff8e1")) },
              { mode: darkMode, value: literalColor(hex("#332600")) },
            ],
          },
        ],
      },
    ]);
    const compiled = compileGraph(graph, { include: [tokenKey("semantic.notice.background")] });

    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    expect(compiled.value.tokens[0]?.values[0]?.value).toEqual(hex("#fff8e1"));
  });
});

function baseGraph() {
  return testGraph({
    tokens: [
      colorToken("scheme.surface", "#ffffff", "#141218"),
      colorToken("scheme.onSurface", "#1d1b20", "#e6e0e9"),
      colorToken("scheme.outlineVariant", "#cac4d0", "#49454f"),
      colorToken("scheme.primary", "#6750a4", "#d0bcff"),
      colorToken("scheme.onPrimary", "#ffffff", "#381e72"),
      colorToken("scheme.error", "#ba1a1a", "#ffb4ab"),
      colorToken("scheme.onError", "#ffffff", "#690005"),
    ],
  });
}

function testGraph(options: { readonly tokens?: readonly TokenNode[] }): ColorSchemeTokenGraph {
  return {
    schemaVersion: "color-scheme-token-graph/v0",
    modes: [lightMode, darkMode],
    tokens: [...(options.tokens ?? [])],
  };
}

function expectProblems<Value, Problem>(
  result:
    | { readonly ok: true; readonly value?: Value; readonly graph?: Value }
    | { readonly ok: false; readonly problems: readonly Problem[] },
): readonly Problem[] {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("Expected result to fail.");
  return result.problems;
}

function colorToken(key: string, light: string, dark: string) {
  return {
    kind: "color" as const,
    key: tokenKey(key),
    values: [
      { mode: lightMode, value: literalColor(hex(light)) },
      { mode: darkMode, value: literalColor(hex(dark)) },
    ],
  };
}
