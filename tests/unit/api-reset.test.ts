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
  serializeTokenGraph,
  serializeTokenLayer,
  tokenRef,
} from "../../src";

const strictGraph = {
  $schema: "https://scheme-tokens.dev/schemas/token-graph.v1.schema.json",
  kind: "scheme-tokens/token-graph",
  formatVersion: 1,
  modes: ["light", "dark"],
  defaultMode: "light",
  defaultVisibility: "public",
  tokens: {
    "brand.400": {
      value: "oklch(78% 0.12 250)",
      visibility: "internal",
    },
    "brand.600": {
      value: "oklch(62% 0.18 250)",
      visibility: "internal",
    },
    primary: {
      value: {
        light: { ref: "brand.600" },
        dark: { ref: "brand.400" },
      },
      description: "Primary action fill",
    },
  },
} as const;

describe("pre-release API reset", () => {
  test("normalizes the one authoring grammar into owned strict artifacts", () => {
    const extensions = { "app.owner": { team: "design" } };
    const tokens = {
      "brand.400": {
        value: "oklch(78% 0.12 250)",
        visibility: "internal" as const,
        extensions,
      },
      "brand.600": {
        value: "oklch(62% 0.18 250)",
        visibility: "internal" as const,
      },
      background: { light: "#ffffff", dark: "#111111" },
      primary: {
        value: {
          light: tokenRef("brand.600"),
          dark: tokenRef("brand.400"),
        },
        description: "Primary action fill",
      },
    };

    const graph = defineTokens(tokens, {
      modes: ["dark", "light"],
      defaultMode: "light",
    });

    expect(graph).toMatchObject({
      kind: "scheme-tokens/token-graph",
      formatVersion: 1,
      modes: ["light", "dark"],
      defaultMode: "light",
      defaultVisibility: "public",
      tokens: {
        background: { value: { dark: "#111111", light: "#ffffff" } },
        primary: {
          value: {
            dark: { ref: "brand.400" },
            light: { ref: "brand.600" },
          },
          description: "Primary action fill",
        },
      },
    });

    extensions["app.owner"].team = "mutated";
    (tokens.primary.value.light as { ref: string }).ref = "brand.400";
    expect(graph.tokens["brand.400"]?.extensions).toEqual({
      "app.owner": { team: "design" },
    });
    expect(graph.tokens.primary?.value).toEqual({
      dark: { ref: "brand.400" },
      light: { ref: "brand.600" },
    });
  });

  test("defaults only genuine single-mode authoring to base", () => {
    const graph = defineTokens({
      background: "#ffffff",
      primary: tokenRef("background"),
    });

    expect(graph.modes).toEqual(["base"]);
    expect(graph.defaultMode).toBe("base");
    expect(graph.tokens.background).toEqual({ value: "#ffffff" });
  });

  test("requires an explicit complete multimode envelope and default", () => {
    expect(() =>
      defineTokens({ background: { light: "#ffffff", dark: "#111111" } } as never),
    ).toThrow(/modes/i);
    expect(() =>
      defineTokens({ background: { light: "#ffffff", dark: "#111111" } }, {
        modes: ["light", "dark"],
      } as never),
    ).toThrow(/defaultMode/i);
    expect(() =>
      defineTokens({ background: { light: "#ffffff" } } as never, {
        modes: ["light", "dark"],
        defaultMode: "light",
      }),
    ).toThrow(/dark/i);
  });

  test("rejects every removed competing authoring shape", () => {
    expect(() =>
      defineTokenGraph({
        tokens: { primary: { valueByMode: { light: "#fff", dark: "#000" } } },
        modes: ["light", "dark"],
        defaultMode: "light",
      } as never),
    ).toThrow(/valueByMode/i);
    expect(() =>
      defineTokenGraph({
        tokens: {
          primary: {
            light: "#fff",
            dark: "#000",
            visibility: "public",
          },
        },
        modes: ["light", "dark"],
        defaultMode: "light",
      } as never),
    ).toThrow(/unknown|visibility|mode/i);
    expect(() =>
      defineTokenGraph({
        tokens: { "brand.primary": "#6750a4" },
        aliases: { primary: "brand.primary" },
      } as never),
    ).toThrow(/aliases/i);
  });

  test("keeps graph mode authority out of layers and owns layer inputs", () => {
    expect(() =>
      defineTokenLayer({
        id: "brand",
        modes: ["light", "dark"],
        tokens: { primary: { light: "#fff", dark: "#000" } },
      } as never),
    ).toThrow(/modes/i);

    const source = { primary: "#6750a4" };
    const layer = defineTokenLayer({ id: "brand", tokens: source });
    const graph = defineTokenGraph({ tokens: {}, layers: [layer] });
    source.primary = "#ff0000";
    (layer.tokens as { primary: { value: string } }).primary.value = "#00ff00";

    expect(graph.layers?.[0]?.tokens.primary?.value).toBe("#6750a4");
  });

  test("uses Result<Value, Problem> for every fallible public operation", () => {
    const parsedGraph = expectOk(parseTokenGraph(strictGraph));
    const layer = defineTokenLayer({ id: "brand", tokens: { accent: "#6750a4" } });
    const parsedLayer = expectOk(parseTokenLayer(JSON.parse(serializeTokenLayer(layer))));
    const compiled = expectOk(compileTokenGraph(parsedGraph));
    const parsedCompiled = expectOk(
      parseCompiledScheme(JSON.parse(serializeCompiledScheme(compiled))),
    );
    const exported = expectOk(exportCssVars(parsedCompiled));

    expect(parsedGraph.kind).toBe("scheme-tokens/token-graph");
    expect(parsedLayer.kind).toBe("scheme-tokens/token-layer");
    expect(parsedCompiled.kind).toBe("scheme-tokens/compiled-scheme");
    expect(exported.css).toContain("--primary:");
    expect(exported.variableByToken.primary).toBe("--primary");
  });

  test("parsers own accepted data and reject noncanonical schema URIs", () => {
    const input = structuredClone(strictGraph) as {
      $schema: string;
      tokens: { primary: { value: { light: { ref: string }; dark: { ref: string } } } };
    };
    const parsed = expectOk(parseTokenGraph(input));
    input.tokens.primary.value.light.ref = "brand.400";
    expect(parsed.tokens.primary?.value).toEqual({
      dark: { ref: "brand.400" },
      light: { ref: "brand.600" },
    });

    input.$schema = "https://example.invalid/token-graph.json";
    expect(parseTokenGraph(input)).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-schema-uri", path: "/$schema" }],
    });
  });

  test("resolves public tokens through internal dependencies before filtering", () => {
    const compiled = expectOk(compileTokenGraph(expectOk(parseTokenGraph(strictGraph))));

    expect(compiled.tokens).toEqual({
      primary: {
        light: "oklch(62% 0.18 250)",
        dark: "oklch(78% 0.12 250)",
      },
    });
    expect(compiled.metadataByToken.primary?.dependenciesByMode).toEqual({
      dark: ["brand.400"],
      light: ["brand.600"],
    });
  });

  test("validates every explicit selection form and emits code-unit order", () => {
    const graph = defineTokens({ z: "z", a: "a", m: "m" });

    expect(
      Object.keys(
        expectOk(
          compileTokenGraph(graph, {
            selection: { keys: ["z", "a"] },
          }),
        ).tokens,
      ),
    ).toEqual(["a", "z"]);
    expect(compileTokenGraph(graph, { selection: { keys: [] } })).toMatchObject({
      ok: false,
      issues: [{ code: "empty-selection" }],
    });
    expect(compileTokenGraph(graph, { selection: { keys: ["a", "a"] } })).toMatchObject({
      ok: false,
      issues: [{ code: "duplicate-selection-key", path: "/selection/keys/1", key: "a" }],
    });
    expect(compileTokenGraph(graph, { selection: { keys: ["missing"] as never } })).toMatchObject({
      ok: false,
      issues: [{ code: "unknown-selection-key", path: "/selection/keys/0", key: "missing" }],
    });
    expect(compileTokenGraph(graph, { selection: { keys: ["Bad Key"] as never } })).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-selection-key", path: "/selection/keys/0", key: "Bad Key" }],
    });
  });

  test("keeps invalid cycle validation bounded for a large functional graph", () => {
    const size = 6_000;
    const tokens: Record<string, { readonly ref: string }> = {};
    for (let index = 0; index < size; index += 1) {
      tokens[`cycle.${index}`] = tokenRef(`cycle.${(index + 1) % size}`);
    }

    expect(compileTokenGraph(defineTokens(tokens))).toMatchObject({
      ok: false,
      issues: [{ code: "reference-cycle" }],
    });
  }, 3_000);

  test("defines exact pretty and compact CSS contracts", () => {
    const compiled = expectOk(
      compileTokenGraph(
        defineTokens(
          {
            background: { light: "#ffffff", dark: "#111111" },
            primary: { light: "#6750a4", dark: "#d0bcff" },
          },
          { modes: ["light", "dark"], defaultMode: "light" },
        ),
      ),
    );

    const pretty = expectOk(
      exportCssVars(compiled, {
        prefix: "color",
        modeSelectors: {
          strategy: "selectors",
          selectors: { dark: ".dark", light: ":root" },
        },
      }),
    );
    expect(pretty.css).toBe(
      ":root {\n" +
        "  --color-background: #ffffff;\n" +
        "  --color-primary: #6750a4;\n" +
        "}\n\n" +
        ".dark {\n" +
        "  --color-background: #111111;\n" +
        "  --color-primary: #d0bcff;\n" +
        "}\n",
    );
    expect(
      expectOk(
        exportCssVars(compiled, {
          format: "compact",
          modeSelectors: { strategy: "class", classPrefix: "theme-" },
        }),
      ).css,
    ).toBe(
      ":root{--background:#ffffff;--primary:#6750a4;}:root.theme-dark{--background:#111111;--primary:#d0bcff;}",
    );
  });

  test("contains callback failures and rejects variable and selector collisions", () => {
    const compiled = expectOk(
      compileTokenGraph(defineTokens({ background: "#fff", primary: "#6750a4" })),
    );

    expect(exportCssVars(compiled, { prefix: "" })).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-css-prefix" }],
    });

    expect(
      exportCssVars(compiled, {
        variableName() {
          throw new Error("consumer failure");
        },
      }),
    ).toMatchObject({ ok: false, issues: [{ code: "invalid-css-variable" }] });
    expect(
      exportCssVars(compiled, {
        variableName: () => undefined as unknown as string,
      }),
    ).toMatchObject({ ok: false, issues: [{ code: "invalid-css-variable" }] });
    expect(
      exportCssVars(compiled, {
        variableName: () => null as unknown as string,
      }),
    ).toMatchObject({ ok: false, issues: [{ code: "invalid-css-variable" }] });
    expect(exportCssVars(compiled, { variableName: () => "--same" })).toMatchObject({
      ok: false,
      issues: [{ code: "duplicate-css-variable", property: "--same" }],
    });

    const multimode = expectOk(compileTokenGraph(expectOk(parseTokenGraph(strictGraph))));
    expect(
      exportCssVars(multimode, {
        modeSelectors: {
          strategy: "selectors",
          selectors: { light: ":root", dark: ":root" },
        },
      }),
    ).toMatchObject({ ok: false, issues: [{ code: "duplicate-mode-selector" }] });
  });

  test("canonical serialization ignores token, mode-map, and mode-envelope insertion order", () => {
    const left = defineTokens(
      {
        z: { dark: "zd", light: "zl" },
        a: { dark: "ad", light: "al" },
      },
      { modes: ["dark", "light"], defaultMode: "light" },
    );
    const right = defineTokens(
      {
        a: { light: "al", dark: "ad" },
        z: { light: "zl", dark: "zd" },
      },
      { modes: ["light", "dark"], defaultMode: "light" },
    );

    expect(serializeTokenGraph(left)).toBe(serializeTokenGraph(right));
    expect(
      serializeTokenGraph(expectOk(parseTokenGraph(JSON.parse(serializeTokenGraph(left))))),
    ).toBe(serializeTokenGraph(left));
  });
});

function expectOk<Value>(
  result:
    | {
        readonly ok: true;
        readonly value: Value;
      }
    | {
        readonly ok: false;
        readonly issues: readonly unknown[];
      },
): Value {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(JSON.stringify(result.issues));
  }
  return result.value;
}
