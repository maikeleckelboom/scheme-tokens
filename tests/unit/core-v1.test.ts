import { describe, expect, test } from "vitest";
import {
  compileTokenGraph,
  compiledSchemeKind,
  defineTokenGraph,
  defineTokenLayer,
  defineTokens,
  exportCssVars,
  parseCompiledScheme,
  parseTokenGraph,
  parseTokenLayer,
  serializeCompiledScheme,
  tokenGraphKind,
  tokenLayerKind,
  tokenRef,
  type CompiledScheme,
  type TokenGraphInput,
  type TokenLayerInput,
} from "../../src";

describe("scheme-tokens core", () => {
  test("compiles the first-path token graph into direct token mode maps", () => {
    const graph = defineTokens({
      background: {
        base: "#ffffff",
        dark: "#111111",
      },
      foreground: {
        base: "#111111",
        dark: "#ffffff",
      },
    });

    const compiled = expectCompileOk(compileTokenGraph(graph));

    expect(compiled.tokens.background?.base).toBe("#ffffff");
    expect(compiled.tokens.background?.dark).toBe("#111111");
    expect(compiled.metadataByToken.background).toMatchObject({
      visibility: "public",
      origin: { kind: "graph" },
      dependenciesByMode: { base: [], dark: [] },
    });
  });

  test("exports CSS variables through direct result fields", () => {
    const graph = defineTokens(
      {
        background: { light: "#ffffff", dark: "#111111" },
        foreground: { light: "#111111", dark: "#ffffff" },
      },
      { modes: ["light", "dark"], defaultMode: "light" },
    );
    const compiled = expectCompileOk(compileTokenGraph(graph));

    const cssExport = exportCssVars(compiled);

    expect(cssExport).toMatchObject({
      ok: true,
      variableByToken: {
        background: "--background",
        foreground: "--foreground",
      },
    });
    if (!cssExport.ok) {
      throw new Error(JSON.stringify(cssExport.issues));
    }
    expect(cssExport.css).toBe(
      ":root {\n" +
        "  --background: #ffffff;\n" +
        "  --foreground: #111111;\n" +
        "}\n\n" +
        ':root[data-scheme="dark"] {\n' +
        "  --background: #111111;\n" +
        "  --foreground: #ffffff;\n" +
        "}\n",
    );
    expect(cssExport.blocks[0]?.declarations[0]).toEqual({
      tokenKey: "background",
      property: "--background",
      value: "#ffffff",
    });
  });

  test("keeps references explicit and does not infer them from bare strings", () => {
    const graph = defineTokenGraph({
      tokens: {
        "brand.primary": {
          value: "#6750a4",
          visibility: "internal",
        },
        primary: tokenRef("brand.primary"),
        literal: "brand.primary",
      },
    });

    const compiled = expectCompileOk(compileTokenGraph(graph, { selection: "all" }));

    expect(compiled.tokens.primary?.base).toBe("#6750a4");
    expect(compiled.metadataByToken.primary?.dependenciesByMode.base).toEqual(["brand.primary"]);
    expect(compiled.tokens.literal?.base).toBe("brand.primary");
    expect(compiled.metadataByToken.literal?.dependenciesByMode.base).toEqual([]);
  });

  test("filters internal tokens by default and supports explicit all selection", () => {
    const graph = defineTokens({
      "brand.primary": {
        value: "#6750a4",
        visibility: "internal",
      },
      primary: tokenRef("brand.primary"),
    });

    expect(expectCompileOk(compileTokenGraph(graph)).tokens).toEqual({
      primary: { base: "#6750a4" },
    });
    expect(
      Object.keys(expectCompileOk(compileTokenGraph(graph, { selection: "all" })).tokens),
    ).toEqual(["brand.primary", "primary"]);
  });

  test("supports authored layers without a source or builder abstraction", () => {
    const base = defineTokenLayer({ id: "base", tokens: { primary: "#6750a4" } });
    const brand = defineTokenLayer({ id: "brand", tokens: { primary: "#ff3b30" } });
    const graph = defineTokenGraph({ tokens: {}, layers: [base, brand] });

    const compiled = expectCompileOk(compileTokenGraph(graph));

    expect(compiled.tokens.primary?.base).toBe("#ff3b30");
    expect(compiled.metadataByToken.primary?.origin).toEqual({ kind: "layer", id: "brand" });
  });

  test("parses public graph, layer, and compiled scheme results with named fields", () => {
    const graphInput = {
      kind: tokenGraphKind,
      formatVersion: 1,
      modes: ["base"],
      defaultMode: "base",
      defaultVisibility: "public",
      tokens: {
        primary: { value: "#6750a4" },
      },
    } satisfies TokenGraphInput;
    const layerInput = {
      kind: tokenLayerKind,
      formatVersion: 1,
      id: "brand",
      defaultVisibility: "public",
      tokens: {
        primary: { value: "#6750a4" },
      },
    } satisfies TokenLayerInput;

    const parsedGraph = parseTokenGraph(graphInput);
    const parsedLayer = parseTokenLayer(layerInput);
    const compiled = expectCompileOk(compileTokenGraph(graphInput));
    const parsedCompiled = parseCompiledScheme(JSON.parse(serializeCompiledScheme(compiled)));

    expect(parsedGraph).toMatchObject({ ok: true, graph: graphInput });
    expect(parsedLayer).toMatchObject({ ok: true, layer: layerInput });
    expect(parsedCompiled).toMatchObject({ ok: true, scheme: compiled });
  });

  test("serializes compiled schemes deterministically with metadata outside token values", () => {
    const graph = defineTokens({
      "brand.primary": {
        value: "#6750a4",
        visibility: "internal",
        description: "Brand primary.",
        extensions: { owner: "design" },
      },
      primary: tokenRef("brand.primary"),
    });
    const compiled = expectCompileOk(compileTokenGraph(graph, { selection: "all" }));

    expect(JSON.parse(serializeCompiledScheme(compiled))).toEqual({
      kind: compiledSchemeKind,
      formatVersion: 1,
      modes: ["base"],
      defaultMode: "base",
      tokens: {
        "brand.primary": { base: "#6750a4" },
        primary: { base: "#6750a4" },
      },
      metadataByToken: {
        "brand.primary": {
          visibility: "internal",
          origin: { kind: "graph" },
          dependenciesByMode: { base: [] },
          description: "Brand primary.",
          extensions: { owner: "design" },
        },
        primary: {
          visibility: "public",
          origin: { kind: "graph" },
          dependenciesByMode: { base: ["brand.primary"] },
        },
      },
    });
  });

  test("reports deterministic JSON-safe diagnostics", () => {
    const invalidGraph = compileTokenGraph({ tokens: {} });
    expect(invalidGraph.ok).toBe(false);
    if (invalidGraph.ok) {
      throw new Error("Expected graph compilation to fail.");
    }
    expect(invalidGraph.issues).toContainEqual(
      expect.objectContaining({ code: "missing-property", path: "/kind" }),
    );
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
        kind: tokenGraphKind,
        formatVersion: 1,
        modes: ["base"],
        defaultMode: "base",
        defaultVisibility: "public",
        tokens: { primary: { value: { colorSpace: "srgb" } } },
      }),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-token-value", path: "/tokens/primary/value" }],
    });
  });
});

function expectCompileOk(result: ReturnType<typeof compileTokenGraph>): CompiledScheme {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(JSON.stringify(result.issues));
  }
  return result.scheme;
}
