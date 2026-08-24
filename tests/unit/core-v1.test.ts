import { describe, expect, test } from "vitest";
import {
  compileTokenGraph,
  defineTokenGraph,
  defineTokenLayer,
  defineTokens,
  exportCssVars,
  parseCompiledScheme,
  parseTokenGraph,
  parseTokenLayer,
  serializeCompiledScheme,
  serializeTokenLayer,
  tokenRef,
  type Result,
} from "../../src";

describe("scheme-tokens core", () => {
  test("compiles direct single-mode tokens", () => {
    const compiled = expectOk(
      compileTokenGraph(
        defineTokens({
          background: "#ffffff",
          foreground: "#111111",
        }),
      ),
    );

    expect(compiled.tokens).toEqual({
      background: { base: "#ffffff" },
      foreground: { base: "#111111" },
    });
    expect(compiled.metadataByToken.background).toMatchObject({
      visibility: "public",
      origin: { kind: "graph" },
      dependenciesByMode: { base: [] },
    });
  });

  test("keeps references explicit and bare strings literal", () => {
    const graph = defineTokenGraph({
      tokens: {
        "brand.600": {
          value: "#6750a4",
          visibility: "internal",
        },
        primary: tokenRef("brand.600"),
        literal: "brand.600",
      },
    });

    const compiled = expectOk(compileTokenGraph(graph, { selection: "all" }));

    expect(compiled.tokens.primary?.base).toBe("#6750a4");
    expect(compiled.metadataByToken.primary?.dependenciesByMode.base).toEqual(["brand.600"]);
    expect(compiled.tokens.literal?.base).toBe("brand.600");
    expect(compiled.metadataByToken.literal?.dependenciesByMode.base).toEqual([]);
  });

  test("filters internal tokens by default and supports exact and all selection", () => {
    const graph = defineTokens({
      "brand.600": {
        value: "#6750a4",
        visibility: "internal",
      },
      primary: tokenRef("brand.600"),
      secondary: "#03dac6",
    });

    expect(Object.keys(expectOk(compileTokenGraph(graph)).tokens)).toEqual([
      "primary",
      "secondary",
    ]);
    expect(Object.keys(expectOk(compileTokenGraph(graph, { selection: "all" })).tokens)).toEqual([
      "brand.600",
      "primary",
      "secondary",
    ]);
    expect(
      expectOk(compileTokenGraph(graph, { selection: { keys: ["secondary"] } })).tokens,
    ).toEqual({ secondary: { base: "#03dac6" } });
  });

  test("reports when public selection contains no tokens", () => {
    expect(
      compileTokenGraph(
        defineTokens({
          secret: { value: "#111111", visibility: "internal" },
        }),
      ),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "no-selected-tokens" }],
    });
  });

  test("composes ordered layers as deterministic token overrides", () => {
    const base = defineTokenLayer({ id: "base", tokens: { primary: "#6750a4" } });
    const brand = defineTokenLayer({ id: "brand", tokens: { primary: "#ff3b30" } });
    const graph = defineTokenGraph({ tokens: {}, layers: [base, brand] });

    const compiled = expectOk(compileTokenGraph(graph));

    expect(compiled.tokens.primary?.base).toBe("#ff3b30");
    expect(compiled.metadataByToken.primary?.origin).toEqual({ kind: "layer", id: "brand" });
  });

  test("composes graph tokens before layers so a layer overrides a graph token", () => {
    const brand = defineTokenLayer({ id: "brand", tokens: { primary: "#layerwins" } });
    const graph = defineTokenGraph({
      tokens: { primary: "#graphvalue", secondary: "#kept" },
      layers: [brand],
    });

    const compiled = expectOk(compileTokenGraph(graph));

    expect(compiled.tokens.primary?.base).toBe("#layerwins");
    expect(compiled.metadataByToken.primary?.origin).toEqual({ kind: "layer", id: "brand" });
    expect(compiled.tokens.secondary?.base).toBe("#kept");
    expect(compiled.metadataByToken.secondary?.origin).toEqual({ kind: "graph" });
  });

  test("replaces the complete shadowed declaration instead of merging metadata", () => {
    const legacy = defineTokenLayer({
      id: "legacy",
      tokens: {
        primary: {
          value: "#shadowed",
          visibility: "internal",
          description: "Shadowed declaration.",
          deprecated: "Use the replacement.",
          extensions: { owner: "legacy" },
        },
      },
    });
    const brand = defineTokenLayer({
      id: "brand",
      tokens: {
        primary: {
          value: "#winner",
          description: "Winning declaration.",
        },
      },
    });

    const compiled = expectOk(
      compileTokenGraph(defineTokenGraph({ tokens: {}, layers: [legacy, brand] })),
    );

    expect(compiled.tokens.primary?.base).toBe("#winner");
    expect(compiled.metadataByToken.primary).toEqual({
      visibility: "public",
      origin: { kind: "layer", id: "brand" },
      dependenciesByMode: { base: [] },
      description: "Winning declaration.",
    });
  });

  test("reports duplicate layer identities at the untrusted boundary", () => {
    const layer = defineTokenLayer({ id: "brand", tokens: { primary: "#6750a4" } });
    const graph = defineTokenGraph({ tokens: {} });

    expect(parseTokenGraph({ ...graph, layers: [layer, layer] })).toMatchObject({
      ok: false,
      issues: [expect.objectContaining({ code: "duplicate-layer-id", layerId: "brand" })],
    });
  });

  test("parses and owns graph, layer, and compiled artifacts", () => {
    const graphInput = {
      kind: "scheme-tokens/token-graph",
      formatVersion: 1,
      modes: ["base"],
      defaultMode: "base",
      defaultVisibility: "public",
      tokens: { primary: { value: "#6750a4" } },
    };
    const layerInput = JSON.parse(
      serializeTokenLayer(defineTokenLayer({ id: "brand", tokens: { primary: "#6750a4" } })),
    ) as unknown;

    const parsedGraph = expectOk(parseTokenGraph(graphInput));
    const parsedLayer = expectOk(parseTokenLayer(layerInput));
    const compiled = expectOk(compileTokenGraph(parsedGraph));
    const parsedCompiled = expectOk(
      parseCompiledScheme(JSON.parse(serializeCompiledScheme(compiled))),
    );

    graphInput.tokens.primary.value = "mutated";
    expect(parsedGraph.tokens.primary?.value).toBe("#6750a4");
    expect(parsedLayer.kind).toBe("scheme-tokens/token-layer");
    expect(parsedCompiled).toEqual(compiled);
  });

  test("serializes compiled metadata outside resolved token values", () => {
    const compiled = expectOk(
      compileTokenGraph(
        defineTokens(
          {
            "brand.600": {
              value: "#6750a4",
              visibility: "internal",
              description: "Brand primary.",
              extensions: { owner: "design" },
            },
            primary: tokenRef("brand.600"),
          },
          { defaultVisibility: "public" },
        ),
        { selection: "all" },
      ),
    );

    expect(JSON.parse(serializeCompiledScheme(compiled))).toEqual({
      kind: "scheme-tokens/compiled-scheme",
      formatVersion: 1,
      modes: ["base"],
      defaultMode: "base",
      tokens: {
        "brand.600": { base: "#6750a4" },
        primary: { base: "#6750a4" },
      },
      metadataByToken: {
        "brand.600": {
          visibility: "internal",
          origin: { kind: "graph" },
          dependenciesByMode: { base: [] },
          description: "Brand primary.",
          extensions: { owner: "design" },
        },
        primary: {
          visibility: "public",
          origin: { kind: "graph" },
          dependenciesByMode: { base: ["brand.600"] },
        },
      },
    });
  });

  test("returns deterministic structured diagnostics for unknown references and cycles", () => {
    expect(
      compileTokenGraph(
        defineTokenGraph({
          tokens: {
            a: tokenRef("b"),
            b: tokenRef("a"),
          },
        }),
      ),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "reference-cycle", cycle: ["a", "b"] }],
    });

    expect(
      parseTokenGraph({
        kind: "scheme-tokens/token-graph",
        formatVersion: 1,
        modes: ["base"],
        defaultMode: "base",
        defaultVisibility: "public",
        tokens: { primary: { value: { ref: "missing.600" } } },
      }),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "unknown-reference", key: "primary" }],
    });
  });

  test("exports structured CSS under the unified result value", () => {
    const compiled = expectOk(compileTokenGraph(defineTokens({ background: "#ffffff" })));
    const exported = expectOk(exportCssVars(compiled));

    expect(exported.css).toBe(":root {\n  --background: #ffffff;\n}\n");
    expect(exported.blocks[0]?.declarations[0]).toEqual({
      tokenKey: "background",
      property: "--background",
      value: "#ffffff",
    });
  });
});

function expectOk<Value, Problem>(result: Result<Value, Problem>): Value {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(JSON.stringify(result.issues));
  }
  return result.value;
}
