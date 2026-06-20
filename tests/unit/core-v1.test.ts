import { describe, expect, test } from "vitest";
import {
  buildScheme,
  compileTokenGraph,
  createSchemeBuilder,
  colorTokenGraphKind,
  colorTokenLayerKind,
  defineTokenLayer,
  defineTokenGraph,
  defineTokens,
  exportCssVars,
  formatCssColor,
  parseColor,
  ref,
  parseTokenGraph,
  serializeCompiledScheme,
  type ColorValue,
  type Issue,
  type Result,
  type ColorTokenGraphInput,
  type ColorTokenSource,
} from "../../src";

function unwrap<Value>(result: Result<Value, Issue>): Value {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(JSON.stringify(result.issues));
  }
  return result.value;
}

function fixedSource(id: string, graph: unknown): ColorTokenSource {
  return {
    id,
    build(): Result<ColorTokenGraphInput, Issue> {
      return { ok: true, value: graph as ColorTokenGraphInput };
    },
  };
}

function color(input: string): ColorValue {
  return unwrap(parseColor(input));
}

function cssDeclaration(tokenKey: string, property: string, value: string) {
  return { tokenKey, property, value };
}

function strictSourceGraph(
  tokenKey: string,
  overrides: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    kind: colorTokenGraphKind,
    formatVersion: 1,
    modes: ["base"],
    defaultMode: "base",
    defaultVisibility: "public",
    tokens: {
      [tokenKey]: { value: color("#ffffff") },
    },
    ...overrides,
  };
}

function withoutProperty(
  input: Readonly<Record<string, unknown>>,
  key: string,
): Record<string, unknown> {
  const copy = { ...input };
  delete copy[key];
  return copy;
}

describe("v1 color parsing and formatting", () => {
  test("parses concrete strings and preserves precision", () => {
    expect(parseColor("#fff8")).toEqual({
      ok: true,
      value: {
        colorSpace: "srgb",
        components: [1, 1, 1],
        alpha: 0.5333333333333333,
        hex: "#ffffff88",
      },
    });

    const extended = parseColor({ colorSpace: "srgb", components: [1.08, 0.12, -0.03] });
    expect(formatCssColor(unwrap(extended))).toBe("color(srgb 1.08 0.12 -0.03)");

    const p3 = parseColor("color(display-p3 0.94 0.28 0.08 / 75%)");
    expect(formatCssColor(unwrap(p3))).toBe("color(display-p3 0.94 0.28 0.08 / 0.75)");
  });

  test("rejects contextual CSS and unsafe objects with issues", () => {
    expect(parseColor("var(--brand)")).toMatchObject({
      ok: false,
      issues: [{ code: "unsupported-color-syntax" }],
    });

    const input = {};
    Object.defineProperty(input, "colorSpace", {
      enumerable: true,
      get() {
        throw new Error("getter should not run");
      },
    });
    expect(parseColor(input)).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-color-input" }],
    });
  });
});

describe("v1 graph and compiler", () => {
  const makeGraph = () =>
    defineTokenGraph({
      modes: ["dark", "light"],
      defaultMode: "light",
      defaultVisibility: "internal",
      tokens: {
        "brand.primary": {
          light: "#6750a4",
          dark: "#d0bcff",
        },
        "brand.on-primary": {
          light: "#ffffff",
          dark: "#381e72",
        },
        "app.action": {
          visibility: "public",
          value: { ref: "brand.primary" },
        },
        "app.action-text": {
          visibility: "public",
          value: { ref: "brand.on-primary" },
        },
      },
    });

  test("defines simple single-mode graphs with safe defaults and shorthands", () => {
    const graph = defineTokenGraph({
      tokens: {
        "app.background": "#ffffff",
        "app.foreground": ref("app.background"),
      },
    });

    expect(graph).toEqual({
      kind: colorTokenGraphKind,
      formatVersion: 1,
      modes: ["base"],
      defaultMode: "base",
      defaultVisibility: "public",
      tokens: {
        "app.background": { value: color("#ffffff") },
        "app.foreground": { value: { ref: "app.background" } },
      },
    });

    const compiled = unwrap(compileTokenGraph(graph));
    expect(Object.keys(compiled.tokens)).toEqual(["app.background", "app.foreground"]);
    expect(compiled.tokens["app.foreground"]?.dependenciesByMode.base).toEqual(["app.background"]);
  });

  test("defines simple token records through defineTokens", () => {
    const tokens = {
      background: "#ffffff",
      foreground: ref("background"),
    } as const;

    expect(defineTokens(tokens)).toEqual(defineTokenGraph({ tokens }));

    const compiled = unwrap(compileTokenGraph(defineTokens(tokens)));
    expect(compiled.tokens.foreground?.dependenciesByMode.base).toEqual(["background"]);
  });

  test("does not reinterpret unsupported bare strings as references", () => {
    const graph = defineTokens({ danger: "red" });
    expect(graph.tokens.danger).toEqual({ value: "red" });
    expect(compileTokenGraph(graph)).toMatchObject({
      ok: false,
      issues: [{ code: "unsupported-color-syntax", path: "/tokens/danger/value" }],
    });
  });

  test("accepts explicit helper and object references", () => {
    const graph = defineTokenGraph({
      tokens: {
        "brand.primary": "#6750a4",
        "app.action": ref("brand.primary"),
        "app.alias": { ref: "brand.primary" },
      },
    });

    const compiled = unwrap(compileTokenGraph(graph));
    expect(compiled.tokens["app.action"]?.dependenciesByMode.base).toEqual(["brand.primary"]);
    expect(compiled.tokens["app.alias"]?.dependenciesByMode.base).toEqual(["brand.primary"]);
  });

  test("reports unresolved explicit references at the reference path", () => {
    expect(
      compileTokenGraph(
        defineTokenGraph({
          tokens: {
            "app.action": ref("brand.primary"),
          },
        }),
      ),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "unknown-reference", path: "/tokens/app.action/value" }],
    });
  });

  test("defineTokens accepts graph helper options for mode-aware authoring", () => {
    const graph = defineTokens(
      {
        background: {
          light: "#ffffff",
          dark: "#141218",
        },
        foreground: {
          light: "#111111",
          dark: "#f5eff7",
        },
      },
      {
        modes: ["light", "dark"],
        defaultMode: "light",
      },
    );

    expect(graph).toEqual(
      defineTokenGraph({
        modes: ["light", "dark"],
        defaultMode: "light",
        tokens: {
          background: {
            light: "#ffffff",
            dark: "#141218",
          },
          foreground: {
            light: "#111111",
            dark: "#f5eff7",
          },
        },
      }),
    );
    expect(unwrap(compileTokenGraph(graph)).defaultMode).toBe("light");
  });

  test("defineTokens rejects options that contain tokens", () => {
    expect(() => defineTokens({ background: "#ffffff" }, { tokens: {} } as never)).toThrow(
      "defineTokens options cannot include tokens.",
    );
  });

  test("defineTokens malformed records fail through the strict graph validation path", () => {
    expect(parseTokenGraph(defineTokens({ "bad key": "#ffffff" }))).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-token-key", path: "/tokens/bad key" }],
    });
  });

  test("defineTokenGraph does not accept ambiguous flat token records", () => {
    expect(() => defineTokenGraph({ background: "#ffffff" } as never)).toThrow(
      "defineTokenGraph input must include tokens.",
    );
  });

  test("defines layers with reference and metadata mode-key shorthands", () => {
    const layer = defineTokenLayer<"light" | "dark">({
      id: "application",
      tokens: {
        "app.background": {
          visibility: "public",
          light: "#ffffff",
          dark: "#141218",
        },
        "app.foreground": {
          visibility: "public",
          value: ref("material3.on-surface"),
        },
      },
    });

    expect(layer.tokens).toEqual({
      "app.background": {
        visibility: "public",
        valueByMode: {
          light: color("#ffffff"),
          dark: color("#141218"),
        },
      },
      "app.foreground": {
        visibility: "public",
        value: { ref: "material3.on-surface" },
      },
    });
  });

  test("strict parser rejects helper-only token-key string shorthand", () => {
    expect(
      parseTokenGraph({
        kind: colorTokenGraphKind,
        formatVersion: 1,
        modes: ["base"],
        defaultMode: "base",
        defaultVisibility: "public",
        tokens: {
          "app.background": "brand.surface",
        },
      }),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-token-definition", path: "/tokens/app.background" }],
    });
  });

  test("strict parser rejects helper-only metadata mode-key shorthand", () => {
    const parsed = parseTokenGraph({
      kind: colorTokenGraphKind,
      formatVersion: 1,
      modes: ["light", "dark"],
      defaultMode: "light",
      defaultVisibility: "public",
      tokens: {
        "app.background": {
          visibility: "public",
          light: color("#ffffff"),
          dark: color("#141218"),
        },
      },
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) {
      throw new Error("Expected helper-only shorthand to be rejected.");
    }
    expect(parsed.issues).toContainEqual(
      expect.objectContaining({
        code: "unknown-property",
        path: "/tokens/app.background/dark",
      }),
    );
  });

  test.each(["camelCase", "snake_case", "PascalCase", "with space", "brand.mixedCase"])(
    "strict parser rejects non-canonical token key %s",
    (key) => {
      expect(
        parseTokenGraph({
          kind: colorTokenGraphKind,
          formatVersion: 1,
          modes: ["base"],
          defaultMode: "base",
          defaultVisibility: "public",
          tokens: {
            [key]: { value: color("#ffffff") },
          },
        }),
      ).toMatchObject({
        ok: false,
        issues: [{ code: "invalid-token-key", path: `/tokens/${key}`, key }],
      });
    },
  );

  test("rejects authoring-helper mode names that collide with token definition keys", () => {
    expect(() =>
      defineTokenGraph({
        modes: ["value", "dark"],
        defaultMode: "value",
        tokens: {
          "app.background": {
            value: "#ffffff",
            dark: "#000000",
          },
        },
      }),
    ).toThrow("defineTokenGraph mode names cannot use token-definition keys: value.");

    expect(() =>
      defineTokenLayer({
        id: "bad",
        modes: ["value", "dark"],
        tokens: {},
      }),
    ).toThrow("defineTokenLayer mode names cannot use token-definition keys: value.");
  });

  test("parses to an owned canonical graph", () => {
    const graph = makeGraph();
    const parsed = unwrap(parseTokenGraph(graph));

    expect(parsed.modes).toEqual(["light", "dark"]);
    expect(parsed.tokens["app.action"]?.visibility).toBe("public");

    (graph as never as { tokens: { "brand.primary": { valueByMode: { light: string } } } }).tokens[
      "brand.primary"
    ].valueByMode.light = "#000000";
    expect(parsed.tokens["brand.primary"]?.valueByMode.light).toEqual(color("#6750a4"));
  });

  test("compiles public selection, dependencies, CSS, and canonical JSON", () => {
    const graph = makeGraph();
    const compiled = unwrap(compileTokenGraph(graph));

    expect(Object.keys(compiled.tokens)).toEqual(["app.action", "app.action-text"]);
    expect(compiled.tokens["app.action"]?.dependenciesByMode.light).toEqual(["brand.primary"]);

    const css = exportCssVars(compiled, { prefix: "theme" });
    expect(css).toEqual({
      ok: true,
      value: {
        css:
          ":root {\n" +
          "  --theme-app--action: #6750a4;\n" +
          "  --theme-app--action-text: #ffffff;\n" +
          "}\n\n" +
          ':root[data-color-scheme="dark"] {\n' +
          "  --theme-app--action: #d0bcff;\n" +
          "  --theme-app--action-text: #381e72;\n" +
          "}\n",
        blocks: [
          {
            mode: "light",
            selector: ":root",
            declarations: [
              cssDeclaration("app.action", "--theme-app--action", "#6750a4"),
              cssDeclaration("app.action-text", "--theme-app--action-text", "#ffffff"),
            ],
          },
          {
            mode: "dark",
            selector: ':root[data-color-scheme="dark"]',
            declarations: [
              cssDeclaration("app.action", "--theme-app--action", "#d0bcff"),
              cssDeclaration("app.action-text", "--theme-app--action-text", "#381e72"),
            ],
          },
        ],
        variableByToken: {
          "app.action": "--theme-app--action",
          "app.action-text": "--theme-app--action-text",
        },
      },
    });

    expect(serializeCompiledScheme(compiled)).toContain('"formatVersion": 1');
    expect(serializeCompiledScheme(compiled).endsWith("\n")).toBe(true);
  });

  test("exports unprefixed CSS custom properties by default and with an empty prefix", () => {
    const compiled = unwrap(
      compileTokenGraph(
        defineTokenGraph({
          tokens: {
            background: "#ffffff",
            foreground: "#111111",
            primary: "#6750a4",
            "primary-foreground": "#ffffff",
            "material3.primary": "#6750a4",
          },
        }),
      ),
    );

    const defaultCss = exportCssVars(compiled);
    expect(defaultCss).toEqual({
      ok: true,
      value: {
        css:
          ":root {\n" +
          "  --background: #ffffff;\n" +
          "  --foreground: #111111;\n" +
          "  --material3--primary: #6750a4;\n" +
          "  --primary: #6750a4;\n" +
          "  --primary-foreground: #ffffff;\n" +
          "}\n",
        blocks: [
          {
            mode: "base",
            selector: ":root",
            declarations: [
              cssDeclaration("background", "--background", "#ffffff"),
              cssDeclaration("foreground", "--foreground", "#111111"),
              cssDeclaration("material3.primary", "--material3--primary", "#6750a4"),
              cssDeclaration("primary", "--primary", "#6750a4"),
              cssDeclaration("primary-foreground", "--primary-foreground", "#ffffff"),
            ],
          },
        ],
        variableByToken: {
          background: "--background",
          foreground: "--foreground",
          "material3.primary": "--material3--primary",
          primary: "--primary",
          "primary-foreground": "--primary-foreground",
        },
      },
    });
    expect(unwrap(defaultCss).css).not.toContain("--color-");
    expect(unwrap(defaultCss).css).not.toContain("--scheme-");
    expect(exportCssVars(compiled, { prefix: "" })).toEqual(exportCssVars(compiled));
    expect(exportCssVars(compiled, { prefix: "color" })).toEqual({
      ok: true,
      value: {
        css:
          ":root {\n" +
          "  --color-background: #ffffff;\n" +
          "  --color-foreground: #111111;\n" +
          "  --color-material3--primary: #6750a4;\n" +
          "  --color-primary: #6750a4;\n" +
          "  --color-primary-foreground: #ffffff;\n" +
          "}\n",
        blocks: [
          {
            mode: "base",
            selector: ":root",
            declarations: [
              cssDeclaration("background", "--color-background", "#ffffff"),
              cssDeclaration("foreground", "--color-foreground", "#111111"),
              cssDeclaration("material3.primary", "--color-material3--primary", "#6750a4"),
              cssDeclaration("primary", "--color-primary", "#6750a4"),
              cssDeclaration("primary-foreground", "--color-primary-foreground", "#ffffff"),
            ],
          },
        ],
        variableByToken: {
          background: "--color-background",
          foreground: "--color-foreground",
          "material3.primary": "--color-material3--primary",
          primary: "--color-primary",
          "primary-foreground": "--color-primary-foreground",
        },
      },
    });
  });

  test("exports CSS and structured variable blocks for single-mode schemes", () => {
    const compiled = unwrap(
      compileTokenGraph(
        defineTokenGraph({
          tokens: {
            background: "#ffffff",
            foreground: "#111111",
          },
        }),
      ),
    );

    expect(exportCssVars(compiled)).toEqual({
      ok: true,
      value: {
        css: ":root {\n  --background: #ffffff;\n  --foreground: #111111;\n}\n",
        blocks: [
          {
            mode: "base",
            selector: ":root",
            declarations: [
              cssDeclaration("background", "--background", "#ffffff"),
              cssDeclaration("foreground", "--foreground", "#111111"),
            ],
          },
        ],
        variableByToken: {
          background: "--background",
          foreground: "--foreground",
        },
      },
    });
    expect(exportCssVars(compiled, { prefix: "" })).toEqual(exportCssVars(compiled));
    expect(exportCssVars(compiled, { prefix: "color" })).toEqual({
      ok: true,
      value: {
        css: ":root {\n  --color-background: #ffffff;\n  --color-foreground: #111111;\n}\n",
        blocks: [
          {
            mode: "base",
            selector: ":root",
            declarations: [
              cssDeclaration("background", "--color-background", "#ffffff"),
              cssDeclaration("foreground", "--color-foreground", "#111111"),
            ],
          },
        ],
        variableByToken: {
          background: "--color-background",
          foreground: "--color-foreground",
        },
      },
    });
  });

  test("exports structured CSS variable blocks for light and dark schemes", () => {
    const compiled = unwrap(compileTokenGraph(makeGraph()));

    expect(
      exportCssVars(compiled, {
        prefix: "color",
        scope: { strategy: "selector", selector: ".preview" },
        modeSelectors: { strategy: "class", classPrefix: "theme-" },
      }),
    ).toEqual({
      ok: true,
      value: {
        css:
          ".preview {\n" +
          "  --color-app--action: #6750a4;\n" +
          "  --color-app--action-text: #ffffff;\n" +
          "}\n\n" +
          ".preview.theme-dark {\n" +
          "  --color-app--action: #d0bcff;\n" +
          "  --color-app--action-text: #381e72;\n" +
          "}\n",
        blocks: [
          {
            mode: "light",
            selector: ".preview",
            declarations: [
              cssDeclaration("app.action", "--color-app--action", "#6750a4"),
              cssDeclaration("app.action-text", "--color-app--action-text", "#ffffff"),
            ],
          },
          {
            mode: "dark",
            selector: ".preview.theme-dark",
            declarations: [
              cssDeclaration("app.action", "--color-app--action", "#d0bcff"),
              cssDeclaration("app.action-text", "--color-app--action-text", "#381e72"),
            ],
          },
        ],
        variableByToken: {
          "app.action": "--color-app--action",
          "app.action-text": "--color-app--action-text",
        },
      },
    });
  });

  test("CSS string output is formatted from the same block model", () => {
    const compiled = unwrap(compileTokenGraph(makeGraph()));
    const options = {
      modeSelectors: {
        strategy: "selectors",
        selectors: {
          light: ":root",
          dark: ".dark",
        },
      },
    } as const;

    const exported = unwrap(exportCssVars(compiled, options));

    expect(exported.blocks.map((block) => block.selector)).toEqual([":root", ".dark"]);
    expect(exported.css).toBe(
      ":root {\n" +
        "  --app--action: #6750a4;\n" +
        "  --app--action-text: #ffffff;\n" +
        "}\n\n" +
        ".dark {\n" +
        "  --app--action: #d0bcff;\n" +
        "  --app--action-text: #381e72;\n" +
        "}\n",
    );
    expect(exported.css).toContain(`${exported.blocks[0]?.declarations[0]?.property}:`);
  });

  test("rejects the removed CSS variablePrefix option at runtime", () => {
    const compiled = unwrap(compileTokenGraph(makeGraph()));
    const oldOptions: unknown = { variablePrefix: "theme" };

    expect(exportCssVars(compiled, oldOptions as never)).toEqual({
      ok: false,
      issues: [{ code: "invalid-css-options", message: "Unknown CSS option: variablePrefix." }],
    });
  });

  test("rejects invalid CSS prefixes with the release-safe issue code", () => {
    const compiled = unwrap(compileTokenGraph(makeGraph()));

    const expected = {
      ok: false,
      issues: [
        {
          code: "invalid-css-prefix",
          message: "prefix must be a lower-kebab single segment.",
        },
      ],
    } as const;
    expect(exportCssVars(compiled, { prefix: "Theme" })).toEqual(expected);
  });

  test("stores direct dependencies without expanding transitive chains", () => {
    const compiled = unwrap(
      compileTokenGraph(
        defineTokenGraph({
          tokens: {
            "brand.primary": "#6750a4",
            "brand.alias": ref("brand.primary"),
            "app.action": ref("brand.alias"),
          },
        }),
      ),
    );

    expect(compiled.tokens["app.action"]?.dependenciesByMode.base).toEqual(["brand.alias"]);
    expect(compiled.tokens["brand.alias"]?.dependenciesByMode.base).toEqual(["brand.primary"]);
  });

  test("reports exact-selection issues and cycles", () => {
    const graph = makeGraph();
    expect(compileTokenGraph(graph, { selection: { keys: [] } })).toMatchObject({
      ok: false,
      issues: [{ code: "empty-selection" }],
    });

    expect(
      compileTokenGraph({
        kind: colorTokenGraphKind,
        formatVersion: 1,
        modes: ["base"],
        defaultMode: "base",
        defaultVisibility: "public",
        tokens: {
          "a.one": { value: { ref: "a.two" } },
          "a.two": { value: { ref: "a.one" } },
        },
      }),
    ).toMatchObject({
      ok: false,
      issues: [
        {
          code: "reference-cycle",
          cycle: ["a.one", "a.two"],
          path: "/tokens/a.one/value",
        },
      ],
    });
  });

  test("strict layers are ordered overlays and later layers win", () => {
    const parsed = unwrap(
      parseTokenGraph({
        kind: colorTokenGraphKind,
        formatVersion: 1,
        modes: ["base"],
        defaultMode: "base",
        defaultVisibility: "public",
        tokens: {
          primary: { value: color("#6750a4") },
        },
        layers: [
          {
            kind: colorTokenLayerKind,
            formatVersion: 1,
            id: "base",
            defaultVisibility: "public",
            tokens: {
              primary: { value: color("#1455d9") },
            },
          },
          {
            kind: colorTokenLayerKind,
            formatVersion: 1,
            id: "brand",
            defaultVisibility: "public",
            tokens: {
              primary: { value: color("#ff3b30") },
            },
          },
        ],
      }),
    );

    expect(parsed.tokens.primary?.origin).toEqual({ kind: "layer", id: "brand" });
    expect(parsed.tokens.primary?.valueByMode.base).toEqual(color("#ff3b30"));
  });

  test("references resolve against final layer winners", () => {
    const compiled = unwrap(
      compileTokenGraph(
        defineTokenGraph({
          tokens: {
            primary: "#6750a4",
            background: ref("primary"),
          },
          layers: [
            defineTokenLayer({
              id: "brand",
              tokens: {
                primary: "#ff3b30",
              },
            }),
          ],
        }),
      ),
    );

    expect(compiled.tokens.background?.valueByMode.base).toEqual(color("#ff3b30"));
    expect(compiled.tokens.background?.dependenciesByMode.base).toEqual(["primary"]);
  });

  test("reports layer id diagnostics with layer JSON Pointer paths", () => {
    expect(
      parseTokenGraph({
        kind: colorTokenGraphKind,
        formatVersion: 1,
        modes: ["base"],
        defaultMode: "base",
        defaultVisibility: "public",
        tokens: {},
        layers: [
          {
            kind: colorTokenLayerKind,
            formatVersion: 1,
            id: "Application",
            defaultVisibility: "public",
            tokens: {},
          },
          {
            kind: colorTokenLayerKind,
            formatVersion: 1,
            id: "brand",
            defaultVisibility: "public",
            tokens: {},
          },
          {
            kind: colorTokenLayerKind,
            formatVersion: 1,
            id: "brand",
            defaultVisibility: "public",
            tokens: {},
          },
        ],
      }),
    ).toMatchObject({
      ok: false,
      issues: [
        { code: "invalid-layer-id", path: "/layers/0/id", layerId: "Application" },
        {
          code: "duplicate-layer-id",
          path: "/layers/2/id",
          layerId: "brand",
          firstPath: "/layers/1/id",
        },
      ],
    });
  });

  test("missing refs and circular refs are detected after layering", () => {
    expect(
      parseTokenGraph({
        kind: colorTokenGraphKind,
        formatVersion: 1,
        modes: ["base"],
        defaultMode: "base",
        defaultVisibility: "public",
        tokens: {},
        layers: [
          {
            kind: colorTokenLayerKind,
            formatVersion: 1,
            id: "application",
            defaultVisibility: "public",
            tokens: {
              primary: { value: { ref: "missing.primary" } },
            },
          },
        ],
      }),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "unknown-reference", path: "/layers/0/tokens/primary/value" }],
    });

    expect(
      parseTokenGraph({
        kind: colorTokenGraphKind,
        formatVersion: 1,
        modes: ["base"],
        defaultMode: "base",
        defaultVisibility: "public",
        tokens: {
          "a.one": { value: color("#ffffff") },
          "a.two": { value: { ref: "a.one" } },
        },
        layers: [
          {
            kind: colorTokenLayerKind,
            formatVersion: 1,
            id: "cycle",
            defaultVisibility: "public",
            tokens: {
              "a.one": { value: { ref: "a.two" } },
            },
          },
        ],
      }),
    ).toMatchObject({
      ok: false,
      issues: [
        {
          code: "reference-cycle",
          cycle: ["a.one", "a.two"],
          path: "/layers/0/tokens/a.one/value",
        },
      ],
    });
  });

  test("reports precise JSON Pointer paths for references", () => {
    expect(
      parseTokenGraph({
        kind: colorTokenGraphKind,
        formatVersion: 1,
        modes: ["light", "dark"],
        defaultMode: "light",
        defaultVisibility: "public",
        tokens: {
          "app.action": {
            valueByMode: {
              light: { ref: "missing.light" },
              dark: color("#000000"),
            },
          },
        },
      }),
    ).toMatchObject({
      ok: false,
      issues: [
        {
          code: "unknown-reference",
          path: "/tokens/app.action/valueByMode/light",
        },
      ],
    });
  });
});

describe("v1 sources", () => {
  test("buildScheme accepts layer-only token overlays without sources", () => {
    const base = defineTokenLayer({
      id: "base",
      tokens: {
        background: "#ffffff",
        foreground: "#111111",
        primary: "#6750a4",
      },
    });
    const brand = defineTokenLayer({
      id: "brand",
      tokens: {
        primary: "#ff3b30",
      },
    });

    const value = unwrap(buildScheme({ layers: [base, brand] }));

    expect(value.modes).toEqual(["base"]);
    expect(value.defaultMode).toBe("base");
    expect(Object.keys(value.tokens)).toEqual(["background", "foreground", "primary"]);
    expect(value.tokens.primary?.origin).toEqual({ kind: "layer", id: "brand" });
    expect(value.tokens.primary?.valueByMode.base).toEqual(color("#ff3b30"));
  });

  test("buildScheme accepts explicit modes for layer-only multi-mode overlays", () => {
    const base = defineTokenLayer<"light" | "dark">({
      id: "base",
      modes: ["light", "dark"],
      tokens: {
        background: {
          light: "#ffffff",
          dark: "#141218",
        },
        foreground: {
          light: "#111111",
          dark: "#f5eff7",
        },
      },
    });
    const brand = defineTokenLayer<"light" | "dark">({
      id: "brand",
      modes: ["light", "dark"],
      tokens: {
        primary: {
          light: "#6750a4",
          dark: "#d0bcff",
        },
      },
    });

    const value = unwrap(
      buildScheme({
        modes: ["light", "dark"],
        defaultMode: "light",
        layers: [base, brand],
      }),
    );

    expect(value.modes).toEqual(["light", "dark"]);
    expect(value.defaultMode).toBe("light");
    expect(Object.keys(value.tokens)).toEqual(["background", "foreground", "primary"]);
    expect(value.tokens.background?.valueByMode.dark).toEqual(color("#141218"));
    expect(exportCssVars(value)).toEqual({
      ok: true,
      value: {
        css:
          ":root {\n" +
          "  --background: #ffffff;\n" +
          "  --foreground: #111111;\n" +
          "  --primary: #6750a4;\n" +
          "}\n\n" +
          ':root[data-color-scheme="dark"] {\n' +
          "  --background: #141218;\n" +
          "  --foreground: #f5eff7;\n" +
          "  --primary: #d0bcff;\n" +
          "}\n",
        blocks: [
          {
            mode: "light",
            selector: ":root",
            declarations: [
              cssDeclaration("background", "--background", "#ffffff"),
              cssDeclaration("foreground", "--foreground", "#111111"),
              cssDeclaration("primary", "--primary", "#6750a4"),
            ],
          },
          {
            mode: "dark",
            selector: ':root[data-color-scheme="dark"]',
            declarations: [
              cssDeclaration("background", "--background", "#141218"),
              cssDeclaration("foreground", "--foreground", "#f5eff7"),
              cssDeclaration("primary", "--primary", "#d0bcff"),
            ],
          },
        ],
        variableByToken: {
          background: "--background",
          foreground: "--foreground",
          primary: "--primary",
        },
      },
    });
  });

  test("buildScheme rejects invalid layer-only mode envelopes", () => {
    const layer = defineTokenLayer({
      id: "brand",
      tokens: {
        primary: "#6750a4",
      },
    });

    expect(
      buildScheme({
        modes: ["light", "dark"],
        defaultMode: "sepia",
        layers: [layer],
      }),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-build-options", path: "/defaultMode" }],
    });
    expect(
      buildScheme({
        modes: ["light", "dark"],
        layers: [layer],
      } as never),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-build-options", path: "/defaultMode" }],
    });
  });

  test("createSchemeBuilder reuses buildScheme behavior for prepared layers", () => {
    const source = fixedSource(
      "material",
      defineTokenGraph({
        defaultVisibility: "internal",
        tokens: {
          "material3.surface": "#ffffff",
          "material3.on-surface": "#111111",
          "material3.primary": "#6750a4",
          "material3.on-primary": "#ffffff",
        },
      }),
    );
    const application = defineTokenLayer({
      id: "application",
      tokens: {
        background: ref("material3.surface"),
        foreground: ref("material3.on-surface"),
        primary: ref("material3.primary"),
        "primary-foreground": ref("material3.on-primary"),
      },
    });

    const builder = createSchemeBuilder({ layers: [application] });
    const shorthandBuilt = builder.build(source);
    const objectBuilt = builder.build({ base: source });
    const oneShotBuilt = buildScheme(source, { layers: [application] });

    expect(shorthandBuilt).toEqual(oneShotBuilt);
    expect(objectBuilt).toEqual(shorthandBuilt);
  });

  test("createSchemeBuilder supports layer-only builds and empty-build diagnostics", () => {
    const layer = defineTokenLayer({
      id: "brand",
      tokens: {
        primary: "#6750a4",
      },
    });

    expect(createSchemeBuilder({ layers: [layer] }).build()).toEqual(
      buildScheme({ layers: [layer] }),
    );
    expect(createSchemeBuilder({}).build()).toEqual(buildScheme({}));
  });

  test("createSchemeBuilder rejects generic build input aliases", () => {
    const builder = createSchemeBuilder({});

    for (const key of ["source", "sourceColors", "variant", "color"] as const) {
      expect(builder.build({ [key]: "#6750a4" } as never)).toMatchObject({
        ok: false,
        issues: [{ code: "invalid-build-options", message: `Unknown build option: ${key}.` }],
      });
    }
  });

  test("createSchemeBuilder prepared config is isolated from caller mutation", () => {
    const layer = defineTokenLayer({
      id: "application",
      tokens: {
        primary: "#6750a4",
      },
    });
    const layers = [layer];
    const builder = createSchemeBuilder({ layers });

    layers.push(
      defineTokenLayer({
        id: "brand",
        tokens: {
          primary: "#ff3b30",
        },
      }),
    );
    (layer.tokens.primary as { value: string }).value = "#000000";

    const value = unwrap(builder.build());

    expect(value.tokens.primary?.origin).toEqual({ kind: "layer", id: "application" });
    expect(value.tokens.primary?.valueByMode.base).toEqual(color("#6750a4"));
  });

  test("buildScheme accepts base-only usage without layers", () => {
    const source = fixedSource(
      "brand",
      defineTokenGraph({
        tokens: {
          primary: "#6750a4",
        },
      }),
    );

    const value = unwrap(buildScheme({ base: [source] }));

    expect(Object.keys(value.tokens)).toEqual(["primary"]);
    expect(value.tokens.primary?.origin).toEqual({ kind: "source", id: "brand" });
  });

  test("buildScheme accepts a single source shorthand", () => {
    const source = fixedSource(
      "brand",
      defineTokenGraph({
        tokens: {
          primary: "#6750a4",
        },
      }),
    );

    const value = unwrap(buildScheme(source));

    expect(Object.keys(value.tokens)).toEqual(["primary"]);
    expect(value.tokens.primary?.origin).toEqual({ kind: "source", id: "brand" });
  });

  test("buildScheme accepts one source through sources and composes caller layers", () => {
    let calls = 0;
    interface CompanyIssue extends Issue<"missing-company-primary"> {}
    const source: ColorTokenSource<CompanyIssue> = {
      id: "company",
      build(): Result<ColorTokenGraphInput, CompanyIssue> {
        calls += 1;
        return {
          ok: true,
          value: defineTokenGraph({
            modes: ["light", "dark"],
            defaultMode: "light",
            defaultVisibility: "internal",
            tokens: {
              "company.primary": {
                valueByMode: {
                  light: "#1455d9",
                  dark: "#b5c4ff",
                },
              },
            },
          }),
        };
      },
    };

    const app = defineTokenLayer({
      formatVersion: 1,
      id: "application",
      defaultVisibility: "public",
      tokens: {
        "app.action": { value: { ref: "company.primary" } },
      },
    });

    const value = unwrap(buildScheme({ base: [source], layers: [app], selection: "all" }));
    expect(calls).toBe(1);
    expect(Object.keys(value.tokens)).toEqual(["app.action", "company.primary"]);
    expect(value.tokens["company.primary"]?.origin).toEqual({
      kind: "source",
      id: "company",
    });
    expect(value.tokens["app.action"]?.origin).toEqual({
      kind: "layer",
      id: "application",
    });
  });

  test("buildScheme accepts a source shorthand with caller layers", () => {
    const source = fixedSource(
      "company",
      defineTokenGraph({
        defaultVisibility: "internal",
        tokens: {
          "company.primary": "#1455d9",
        },
      }),
    );
    const app = defineTokenLayer({
      id: "application",
      tokens: {
        "app.action": ref("company.primary"),
      },
    });

    const value = unwrap(buildScheme(source, { layers: [app] }));

    expect(Object.keys(value.tokens)).toEqual(["app.action"]);
    expect(value.tokens["app.action"]?.origin).toEqual({
      kind: "layer",
      id: "application",
    });
  });

  test("buildScheme lets layers override source tokens", () => {
    const source = fixedSource(
      "material",
      defineTokenGraph({
        tokens: {
          primary: "#6750a4",
          background: ref("primary"),
        },
      }),
    );
    const layer = defineTokenLayer({
      id: "brand",
      tokens: {
        primary: "#ff3b30",
      },
    });

    const value = unwrap(buildScheme({ base: [source], layers: [layer] }));

    expect(value.tokens.primary?.origin).toEqual({ kind: "layer", id: "brand" });
    expect(value.tokens.background?.valueByMode.base).toEqual(color("#ff3b30"));
  });

  test("buildScheme composes multiple sources in array order", () => {
    const palette: ColorTokenSource = {
      id: "palette",
      build(): Result<ColorTokenGraphInput, Issue> {
        return {
          ok: true,
          value: defineTokenGraph({
            defaultVisibility: "internal",
            tokens: {
              "palette.primary": "#1455d9",
            },
          }),
        };
      },
    };
    const semantic: ColorTokenSource = {
      id: "semantic",
      build(): Result<ColorTokenGraphInput, Issue> {
        return {
          ok: true,
          value: defineTokenGraph({
            tokens: {
              "semantic.action": { ref: "palette.primary" },
            },
          }),
        };
      },
    };

    const value = unwrap(buildScheme({ base: [palette, semantic], selection: "all" }));

    expect(Object.keys(value.tokens)).toEqual(["palette.primary", "semantic.action"]);
    expect(value.tokens["palette.primary"]?.origin).toEqual({
      kind: "source",
      id: "palette",
    });
    expect(value.tokens["semantic.action"]?.origin).toEqual({
      kind: "source",
      id: "semantic",
    });
    expect(value.tokens["palette.primary"]?.visibility).toBe("internal");
    expect(value.tokens["semantic.action"]?.visibility).toBe("public");
    expect(value.tokens["semantic.action"]?.dependenciesByMode.base).toEqual(["palette.primary"]);
  });

  test("buildScheme accepts source array shorthand", () => {
    const palette = fixedSource(
      "palette",
      defineTokenGraph({
        defaultVisibility: "internal",
        tokens: {
          "palette.primary": "#1455d9",
        },
      }),
    );
    const semantic = fixedSource(
      "semantic",
      defineTokenGraph({
        tokens: {
          "semantic.action": ref("palette.primary"),
        },
      }),
    );

    const value = unwrap(buildScheme([palette, semantic], { selection: "all" }));

    expect(Object.keys(value.tokens)).toEqual(["palette.primary", "semantic.action"]);
    expect(value.tokens["palette.primary"]?.origin).toEqual({
      kind: "source",
      id: "palette",
    });
  });

  test("buildScheme accepts source array shorthand with caller layers", () => {
    const palette = fixedSource(
      "palette",
      defineTokenGraph({
        defaultVisibility: "internal",
        tokens: {
          "palette.primary": "#1455d9",
        },
      }),
    );
    const semantic = fixedSource(
      "semantic",
      defineTokenGraph({
        defaultVisibility: "internal",
        tokens: {
          "semantic.action": ref("palette.primary"),
        },
      }),
    );
    const app = defineTokenLayer({
      id: "application",
      tokens: {
        "app.action": ref("semantic.action"),
      },
    });

    const value = unwrap(buildScheme([palette, semantic], { layers: [app] }));

    expect(Object.keys(value.tokens)).toEqual(["app.action"]);
    expect(value.tokens["app.action"]?.origin).toEqual({
      kind: "layer",
      id: "application",
    });
  });

  test("buildScheme validates every source graph strict envelope before composition", () => {
    const valid = fixedSource("valid", strictSourceGraph("valid.token"));
    const invalidModes = strictSourceGraph("bad.modes", { modes: "base" });
    const missingModes = withoutProperty(strictSourceGraph("bad.missing-modes"), "modes");
    const invalidDefaultMode = strictSourceGraph("bad.default-mode", {
      defaultMode: "missing",
    });
    const missingDefaultMode = withoutProperty(
      strictSourceGraph("bad.missing-default-mode"),
      "defaultMode",
    );
    const invalidDefaultVisibility = strictSourceGraph("bad.default-visibility", {
      defaultVisibility: "hidden",
    });
    const missingDefaultVisibility = withoutProperty(
      strictSourceGraph("bad.missing-default-visibility"),
      "defaultVisibility",
    );
    const invalidTokens = strictSourceGraph("bad.tokens", { tokens: [] });
    const missingTokens = withoutProperty(strictSourceGraph("bad.missing-tokens"), "tokens");
    const invalidLayers = strictSourceGraph("bad.layers", { layers: {} });

    const scenarios = [
      {
        graph: strictSourceGraph("bad.format-version", { formatVersion: 2 }),
        issue: { code: "invalid-format-version", path: "/base/1/formatVersion" },
      },
      {
        graph: withoutProperty(strictSourceGraph("bad.missing-format-version"), "formatVersion"),
        issue: { code: "missing-property", path: "/base/1/formatVersion" },
      },
      {
        graph: invalidModes,
        issue: { code: "invalid-mode-key", path: "/base/1/modes" },
      },
      {
        graph: missingModes,
        issue: { code: "missing-property", path: "/base/1/modes" },
      },
      {
        graph: invalidDefaultMode,
        issue: { code: "default-mode-not-found", path: "/base/1/defaultMode" },
      },
      {
        graph: missingDefaultMode,
        issue: { code: "missing-property", path: "/base/1/defaultMode" },
      },
      {
        graph: invalidDefaultVisibility,
        issue: { code: "invalid-default-visibility", path: "/base/1/defaultVisibility" },
      },
      {
        graph: missingDefaultVisibility,
        issue: { code: "invalid-default-visibility", path: "/base/1/defaultVisibility" },
      },
      {
        graph: invalidTokens,
        issue: { code: "invalid-object", path: "/base/1/tokens" },
      },
      {
        graph: missingTokens,
        issue: { code: "missing-property", path: "/base/1/tokens" },
      },
      {
        graph: strictSourceGraph("bad.unknown", { unexpected: true }),
        issue: { code: "unknown-property", path: "/base/1/unexpected" },
      },
      {
        graph: invalidLayers,
        issue: { code: "invalid-object", path: "/base/1/layers" },
      },
    ] as const;

    for (const scenario of scenarios) {
      expect(buildScheme({ base: [valid, fixedSource("bad", scenario.graph)] })).toMatchObject({
        ok: false,
        issues: [scenario.issue],
      });
    }
  });

  test("buildScheme compares source modes by canonical semantics", () => {
    const first = fixedSource(
      "first",
      defineTokenGraph({
        modes: ["dark", "light"],
        defaultMode: "light",
        tokens: {
          "first.token": {
            valueByMode: {
              light: "#ffffff",
              dark: "#000000",
            },
          },
        },
      }),
    );
    const second = fixedSource(
      "second",
      defineTokenGraph({
        modes: ["light", "dark"],
        defaultMode: "light",
        tokens: {
          "second.token": {
            valueByMode: {
              light: ref("first.token"),
              dark: ref("first.token"),
            },
          },
        },
      }),
    );

    const value = unwrap(buildScheme({ base: [first, second] }));

    expect(value.modes).toEqual(["light", "dark"]);
    expect(Object.keys(value.tokens)).toEqual(["first.token", "second.token"]);
    expect(value.tokens["second.token"]?.dependenciesByMode.light).toEqual(["first.token"]);
  });

  test("buildScheme rejects incompatible source mode sets and default modes", () => {
    const first = fixedSource(
      "first",
      defineTokenGraph({
        modes: ["light", "dark"],
        defaultMode: "light",
        tokens: {
          "first.token": {
            valueByMode: {
              light: "#ffffff",
              dark: "#000000",
            },
          },
        },
      }),
    );
    const differentModeSet = fixedSource(
      "second",
      defineTokenGraph({
        modes: ["light", "dim"],
        defaultMode: "light",
        tokens: {
          "second.token": {
            valueByMode: {
              light: "#ffffff",
              dim: "#eeeeee",
            },
          },
        },
      }),
    );
    const differentDefaultMode = fixedSource(
      "third",
      defineTokenGraph({
        modes: ["dark", "light"],
        defaultMode: "dark",
        tokens: {
          "third.token": {
            valueByMode: {
              light: "#ffffff",
              dark: "#000000",
            },
          },
        },
      }),
    );

    expect(buildScheme({ base: [first, differentModeSet] })).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-source-result", path: "/base/1/modes" }],
    });
    expect(buildScheme({ base: [first, differentDefaultMode] })).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-source-result", path: "/base/1/defaultMode" }],
    });
  });

  test("buildScheme validates explicit build envelopes against the first source graph", () => {
    const source = fixedSource(
      "first",
      defineTokenGraph({
        modes: ["dark", "light"],
        defaultMode: "light",
        defaultVisibility: "internal",
        tokens: {
          "first.token": {
            visibility: "public",
            valueByMode: {
              light: "#ffffff",
              dark: "#000000",
            },
          },
        },
      }),
    );

    const value = unwrap(
      buildScheme({
        modes: ["light", "dark"],
        defaultMode: "light",
        defaultVisibility: "internal",
        base: [source],
      }),
    );
    expect(value.modes).toEqual(["light", "dark"]);
    expect(Object.keys(value.tokens)).toEqual(["first.token"]);

    expect(
      buildScheme({
        modes: ["light", "dim"],
        defaultMode: "light",
        base: [source],
      }),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-build-options", path: "/modes" }],
    });
    expect(
      buildScheme({
        modes: ["light", "dark"],
        defaultMode: "dark",
        base: [source],
      }),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-build-options", path: "/defaultMode" }],
    });
    expect(buildScheme({ defaultVisibility: "public", base: [source] })).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-build-options", path: "/defaultVisibility" }],
    });
  });

  test("buildScheme preserves source-local defaultVisibility and explicit visibility", () => {
    const palette = fixedSource(
      "palette",
      defineTokenGraph({
        defaultVisibility: "internal",
        tokens: {
          "palette.primary": "#1455d9",
        },
      }),
    );
    const semantic = fixedSource(
      "semantic",
      defineTokenGraph({
        defaultVisibility: "public",
        tokens: {
          "semantic.action": ref("palette.primary"),
          "semantic.hidden": { visibility: "internal", value: "#000000" },
        },
      }),
    );

    const value = unwrap(buildScheme({ base: [palette, semantic], selection: "all" }));

    expect(value.tokens["palette.primary"]?.visibility).toBe("internal");
    expect(value.tokens["semantic.action"]?.visibility).toBe("public");
    expect(value.tokens["semantic.hidden"]?.visibility).toBe("internal");
    expect(value.tokens["palette.primary"]?.origin).toEqual({
      kind: "source",
      id: "palette",
    });
    expect(value.tokens["semantic.action"]?.origin).toEqual({
      kind: "source",
      id: "semantic",
    });
    expect(Object.keys(value.tokens)).toEqual([
      "palette.primary",
      "semantic.action",
      "semantic.hidden",
    ]);
  });

  test("buildScheme composes caller layers after all sources", () => {
    const palette: ColorTokenSource = {
      id: "palette",
      build(): Result<ColorTokenGraphInput, Issue> {
        return {
          ok: true,
          value: defineTokenGraph({
            defaultVisibility: "internal",
            tokens: {
              "palette.primary": "#1455d9",
            },
          }),
        };
      },
    };
    const semantic: ColorTokenSource = {
      id: "semantic",
      build(): Result<ColorTokenGraphInput, Issue> {
        return {
          ok: true,
          value: defineTokenGraph({
            defaultVisibility: "internal",
            tokens: {
              "semantic.action": { ref: "palette.primary" },
            },
          }),
        };
      },
    };
    const app = defineTokenLayer({
      id: "application",
      defaultVisibility: "public",
      tokens: {
        "app.action": { ref: "semantic.action" },
      },
    });

    const value = unwrap(buildScheme({ base: [palette, semantic], layers: [app] }));

    expect(Object.keys(value.tokens)).toEqual(["app.action"]);
    expect(value.tokens["app.action"]?.origin).toEqual({
      kind: "layer",
      id: "application",
    });
  });

  test("buildScheme accepts structural source metadata and preserves build receiver", () => {
    const source = {
      id: "brand",
      primary: "#1455d9",
      build(): Result<ColorTokenGraphInput, Issue> {
        return {
          ok: true,
          value: defineTokenGraph({
            tokens: {
              "brand.primary": this.primary,
            },
          }),
        };
      },
    };

    const built = unwrap(buildScheme({ base: [source] }));

    expect(built.tokens["brand.primary"]?.valueByMode.base).toEqual(color("#1455d9"));
  });

  test("buildScheme rejects missing, empty, and singular contributor options", () => {
    expect(buildScheme({} as never)).toMatchObject({
      ok: false,
      issues: [
        {
          code: "invalid-build-options",
          message: "buildScheme requires at least one base input or layer.",
        },
      ],
    });
    expect(buildScheme([] as never)).toMatchObject({
      ok: false,
      issues: [
        {
          code: "invalid-build-options",
          message: "buildScheme requires at least one base input or layer.",
        },
      ],
    });
    expect(buildScheme({ base: [] } as never)).toMatchObject({
      ok: false,
      issues: [
        {
          code: "invalid-build-options",
          message: "buildScheme requires at least one base input or layer.",
        },
      ],
    });
    expect(buildScheme({ base: [], layers: [] } as never)).toMatchObject({
      ok: false,
      issues: [
        {
          code: "invalid-build-options",
          message: "buildScheme requires at least one base input or layer.",
        },
      ],
    });
    expect(buildScheme([defineTokenLayer({ id: "brand", tokens: {} })] as never)).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-build-options", path: "/base/0" }],
    });
    expect(buildScheme(defineTokenLayer({ id: "brand", tokens: {} }) as never, {})).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-build-options", path: "/base" }],
    });
    expect(
      buildScheme(fixedSource("brand", defineTokenGraph({ tokens: {} })), {
        base: [fixedSource("other", defineTokenGraph({ tokens: {} }))],
      } as never),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-build-options", path: "/base" }],
    });
    expect(
      buildScheme({
        source: {
          id: "brand",
          build: () => ({ ok: true, value: defineTokenGraph({ tokens: {} }) }),
        },
      } as never),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-build-options", message: "Unknown build option: source." }],
    });
    const oldContributorOption = `frag${"ments"}`;
    expect(buildScheme({ [oldContributorOption]: [] } as never)).toMatchObject({
      ok: false,
      issues: [
        {
          code: "invalid-build-options",
          message: `Unknown build option: ${oldContributorOption}.`,
        },
      ],
    });
  });

  test("buildScheme rejects duplicate source ids", () => {
    const source = {
      id: "brand",
      build: () => ({ ok: true as const, value: defineTokenGraph({ tokens: {} }) }),
    };

    expect(buildScheme({ base: [source, source] })).toMatchObject({
      ok: false,
      issues: [
        {
          code: "duplicate-source-id",
          path: "/base/1/id",
          sourceId: "brand",
          firstPath: "/base/0/id",
        },
      ],
    });
  });

  test("buildScheme rejects duplicate token keys across sources", () => {
    const first = {
      id: "first",
      build: () =>
        ({
          ok: true,
          value: defineTokenGraph({ tokens: { "brand.primary": "#1455d9" } }),
        }) as const,
    };
    const second = {
      id: "second",
      build: () =>
        ({
          ok: true,
          value: defineTokenGraph({ tokens: { "brand.primary": "#6750a4" } }),
        }) as const,
    };

    expect(buildScheme({ base: [first, second] })).toMatchObject({
      ok: false,
      issues: [
        {
          code: "duplicate-token-key",
          path: "/base/1/tokens/brand.primary",
          firstPath: "/base/0/tokens/brand.primary",
        },
      ],
    });
  });
});

describe("public boundaries reject hostile unknown input without throwing", () => {
  test("plain-data readers do not invoke hostile object traps as exceptions", () => {
    const hostile = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new Error("prototype trap should be contained");
        },
      },
    );

    expect(() => parseColor(hostile)).not.toThrow();
    expect(() => parseTokenGraph(hostile)).not.toThrow();
    expect(parseColor(hostile)).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-color-input" }],
    });
    expect(parseTokenGraph(hostile)).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-object" }],
    });
  });
});
