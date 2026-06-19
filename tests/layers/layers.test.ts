import { describe, expect, it } from "vitest";
import {
  compileGraph,
  hex,
  validateGraph,
  type ColorSchemeTokenGraphInput,
  type ColorSchemeTokenLayerInput,
  type TokenNodeInput,
} from "../../src/index";
import { applyLayers } from "../../src/layers/applyLayers";

describe("token layers", () => {
  it("adds layer aliases without mutating the original graph", () => {
    const graph = baseGraph();
    const layered = applyLayers(graph, [applicationLayer]);

    expect(graph.tokens).toHaveLength(5);
    expect(layered.tokens).toHaveLength(9);
    expect(applicationLayer.tokens.map((token) => String(token.key))).toEqual([
      "app.action",
      "app.actionText",
      "app.border",
      "app.notice",
    ]);
    expect(validateGraph(layered).ok).toBe(true);
  });

  it("is chainable and leaves duplicate token keys for graph validation to reject", () => {
    const graph = baseGraph();
    const firstLayer: ColorSchemeTokenLayerInput = {
      name: "first",
      tokens: [{ kind: "alias", key: "app.action", target: "brand.primary" }],
    };
    const secondLayer: ColorSchemeTokenLayerInput = {
      name: "second",
      tokens: [{ kind: "alias", key: "app.action", target: "app.canvas" }],
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
            key: "app.action",
            target: "app.missing",
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
            key: "app.activeSurface",
            target: [
              { mode: "light", value: "app.canvas" },
              { mode: "dark", value: "brand.primary" },
            ],
          },
        ],
      },
    ]);
    const compiled = compileGraph(graph, { include: ["app.activeSurface"] });

    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    expect(compiled.value.tokens).toHaveLength(1);
    expect(compiled.value.tokens[0]?.values.map((entry) => entry.value)).toEqual([
      hex("#ffffff"),
      hex("#d0bcff"),
    ]);
  });

  it("supports authored color tokens with raw color string payloads", () => {
    const graph = applyLayers(baseGraph(), [
      {
        name: "authored-color",
        tokens: [
          {
            kind: "color",
            key: "app.noticeBackground",
            values: [
              { mode: "light", value: "#fff8e1" },
              { mode: "dark", value: "#332600" },
            ],
          },
        ],
      },
    ]);
    const compiled = compileGraph(graph, { include: ["app.noticeBackground"] });

    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    expect(compiled.value.tokens[0]?.values[0]?.value).toEqual(hex("#fff8e1"));
  });
});

const applicationLayer: ColorSchemeTokenLayerInput = {
  name: "application",
  tokens: [
    { kind: "alias", key: "app.action", target: "brand.primary" },
    { kind: "alias", key: "app.actionText", target: "brand.onPrimary" },
    { kind: "alias", key: "app.border", target: "brand.outline" },
    { kind: "alias", key: "app.notice", target: "brand.tertiary" },
  ],
};

function baseGraph() {
  return testGraph({
    tokens: [
      colorToken("app.canvas", "#ffffff", "#141218"),
      colorToken("brand.primary", "#6750a4", "#d0bcff"),
      colorToken("brand.onPrimary", "#ffffff", "#381e72"),
      colorToken("brand.outline", "#cac4d0", "#49454f"),
      colorToken("brand.tertiary", "#7d5260", "#efb8c8"),
    ],
  });
}

function testGraph(options: {
  readonly tokens?: readonly TokenNodeInput[];
}): ColorSchemeTokenGraphInput {
  return {
    schemaVersion: "color-scheme-token-graph/v0",
    modes: ["light", "dark"],
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
    key,
    values: [
      { mode: "light", value: light },
      { mode: "dark", value: dark },
    ],
  };
}
