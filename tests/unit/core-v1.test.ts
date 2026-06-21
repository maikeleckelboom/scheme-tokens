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
  parseCompiledScheme,
  parseTokenGraph,
  serializeCompiledScheme,
  tokenRef,
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
  const javascriptOnlyNumbers = ["0x10", "0b10", "0o10", "1_000", "Infinity", "NaN"] as const;
  const colorFunctionNumberCases = [
    ["rgb()", (value: string) => `rgb(${value} 0 0)`],
    ["hsl()", (value: string) => `hsl(${value} 50% 50%)`],
    ["hwb()", (value: string) => `hwb(270 ${value}% 10%)`],
    ["lab()", (value: string) => `lab(${value} 20 -30)`],
    ["lch()", (value: string) => `lch(50 ${value} 270)`],
    ["oklab()", (value: string) => `oklab(${value} 0.1 -0.1)`],
    ["oklch()", (value: string) => `oklch(0.7 ${value} 265)`],
    ["color()", (value: string) => `color(display-p3 ${value} 0 0)`],
  ] as const;

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

    const structured = parseColor({ colorSpace: "srgb", components: [0.92, 0.12, 0.03] });
    expect(formatCssColor(unwrap(structured))).toBe("color(srgb 0.92 0.12 0.03)");

    const p3 = parseColor("color(display-p3 0.94 0.28 0.08 / 75%)");
    expect(formatCssColor(unwrap(p3))).toBe("color(display-p3 0.94 0.28 0.08 / 0.75)");
  });

  test.each([
    ["rgb(1e2 5e1 0 / 5e-1)", "color(srgb 0.39215686274509803 0.19607843137254902 0 / 0.5)"],
    ["hsl(-9e1 5e1% .5e2%)", "hsl(270 50% 50%)"],
    ["hwb(+90 .5% 1e1%)", "hwb(90 0.5% 10%)"],
    ["lab(.5 1e-3 -2)", "lab(0.5% 0.001 -2)"],
    ["lch(+5e1 4e1 -9e1)", "lch(50% 40 270)"],
    ["oklab(7e-1 1e-1 -1e-1)", "oklab(0.7 0.1 -0.1)"],
    ["color(display-p3 4e-1 .3 +8e-1)", "color(display-p3 0.4 0.3 0.8)"],
    ["oklch(7e-1 1.2e-1 265)", "oklch(0.7 0.12 265)"],
  ] as const)("accepts CSS decimal and exponent numeric syntax in %s", (input, output) => {
    expect(formatCssColor(unwrap(parseColor(input)))).toBe(output);
  });

  test.each([
    "rgb(0x10 0 0)",
    "rgb(0b10 0 0)",
    "rgb(0o10 0 0)",
    "rgb(1_000 0 0)",
    "rgb(Infinity 0 0)",
    "rgb(NaN 0 0)",
    "rgb(12abc 0 0)",
    "",
  ])("rejects non-CSS numeric syntax %s", (input) => {
    expect(parseColor(input)).toMatchObject({ ok: false });
  });

  test.each(
    colorFunctionNumberCases.flatMap(([label, createInput]) =>
      javascriptOnlyNumbers.map((value) => [label, value, createInput(value)] as const),
    ),
  )("rejects JavaScript-only numeric syntax in %s: %s", (_label, _value, input) => {
    expect(parseColor(input)).toMatchObject({ ok: false });
  });

  test.each([
    ["hsl(270 50% 50%)", "hsl(270 50% 50%)"],
    ["hwb(270 20% 10%)", "hwb(270 20% 10%)"],
    ["lab(50 20 -30)", "lab(50% 20 -30)"],
    ["lch(50 40 270)", "lch(50% 40 270)"],
    ["oklab(0.7 0.1 -0.1)", "oklab(0.7 0.1 -0.1)"],
    ["oklch(0.7 0.12 265)", "oklch(0.7 0.12 265)"],
    ["color(display-p3 0.4 0.3 0.8)", "color(display-p3 0.4 0.3 0.8)"],
    ["color(rec2020 0.4 0.3 0.8)", "color(rec2020 0.4 0.3 0.8)"],
    ["transparent", "color(srgb 0 0 0 / 0)"],
    ["rgb(255 0 0 / 50%)", "color(srgb 1 0 0 / 0.5)"],
    ["hsl(270 50% 50% / 25%)", "hsl(270 50% 50% / 0.25)"],
    ["hsl(none 50% 50%)", "hsl(none 50% 50%)"],
    ["lab(none 20 -30)", "lab(none 20 -30)"],
  ] as const)("formats %s without changing the stored color meaning", (input, output) => {
    expect(formatCssColor(unwrap(parseColor(input)))).toBe(output);
  });

  test("normalizes hue into the stored hue domain", () => {
    expect(unwrap(parseColor("lch(50 40 -90)")).components).toEqual([50, 40, 270]);
    expect(formatCssColor(unwrap(parseColor("hsl(630 50% 50%)")))).toBe("hsl(270 50% 50%)");
  });

  test.each([
    ["hsl(270 101% 50%)", "invalid-color-component"],
    ["hwb(270 20% -1%)", "invalid-color-component"],
    ["lch(50 -1 270)", "invalid-color-component"],
    ["oklch(0.7 -0.01 265)", "invalid-color-component"],
    [{ colorSpace: "srgb", components: [1.08, 0.12, 0.03], alpha: 1 }, "invalid-color-component"],
  ] as const)("rejects out-of-domain color components in %s", (input, code) => {
    expect(parseColor(input)).toMatchObject({ ok: false, issues: [{ code }] });
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
      },
      semanticTokens: {
        "app.action": {
          value: { ref: "brand.primary" },
        },
        "app.action-text": {
          value: { ref: "brand.on-primary" },
        },
      },
    });

  test("defines simple single-mode graphs with safe defaults and shorthands", () => {
    const graph = defineTokenGraph({
      tokens: {
        "app.background": "#ffffff",
        "app.foreground": tokenRef("app.background"),
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
      foreground: tokenRef("background"),
    } as const;

    expect(defineTokens(tokens)).toEqual(defineTokenGraph({ tokens }));

    const compiled = unwrap(compileTokenGraph(defineTokens(tokens)));
    expect(compiled.tokens.foreground?.dependenciesByMode.base).toEqual(["background"]);
  });

  test("defines alias fields through explicit reference values", () => {
    const graph = defineTokenGraph({
      tokens: {
        "brand.primary": "#6750a4",
      },
      aliases: {
        "app.primary": "brand.primary",
      },
    });
    const layer = defineTokenLayer<"light" | "dark">({
      id: "application",
      aliases: {
        "app.background": "material3.surface",
        "app.foreground": "material3.on-surface",
        "app.primary": "material3.primary",
        "app.primary-foreground": "material3.on-primary",
      },
    });

    expect(graph.tokens["app.primary"]).toEqual({ value: { ref: "brand.primary" } });
    expect(layer.tokens["app.background"]).toEqual({ value: { ref: "material3.surface" } });
  });

  test("alias fields reject invalid alias records", () => {
    expect(() =>
      defineTokenGraph({
        tokens: {},
        aliases: null as never,
      }),
    ).toThrow("defineTokenGraph aliases must be a plain object record.");
    expect(() =>
      defineTokenLayer({
        id: "application",
        aliases: { primary: "#6750a4" },
      }),
    ).toThrow(
      'defineTokenLayer token "primary" reference must be a dot-separated lower-kebab token key.',
    );
    expect(() =>
      defineTokenLayer({
        id: "application",
        aliases: { primary: { ref: "brand.primary" } } as never,
      }),
    ).toThrow('defineTokenLayer alias "primary" must target a token key string.');
    expect(() =>
      defineTokenGraph({
        tokens: {
          primary: "#6750a4",
        },
        aliases: {
          primary: "brand.primary",
        },
      }),
    ).toThrow('defineTokenGraph aliases cannot redefine token "primary" from tokens.');
    expect(() =>
      defineTokenLayer({
        id: "application",
        tokens: {
          primary: "#6750a4",
        },
        aliases: {
          primary: "brand.primary",
        },
      }),
    ).toThrow('defineTokenLayer aliases cannot redefine token "primary" from tokens.');
  });

  test("alias fields compile as references", () => {
    const graph = defineTokenGraph({
      tokens: {
        "brand.primary": "#6750a4",
      },
      aliases: {
        "app.primary": "brand.primary",
      },
    });

    const compiled = unwrap(compileTokenGraph(graph, { selection: "all" }));

    expect(compiled.tokens["app.primary"]?.dependenciesByMode.base).toEqual(["brand.primary"]);
  });

  test("defineTokens rejects aliases options", () => {
    expect(() =>
      defineTokens(
        {
          primary: "#6750a4",
        },
        {
          aliases: {
            "app.primary": "primary",
          },
        } as never,
      ),
    ).toThrow("defineTokens options cannot include aliases.");
  });

  test.each(["red", "banana", "var(--x)", "brand.primary"])(
    "helper calls reject unsupported bare string %s before returning artifacts",
    (value) => {
      expect(() => defineTokens({ danger: value })).toThrow(
        /Use tokenRef\("token\.key"\) or \{ ref: "token\.key" \} for references\./,
      );
      expect(() =>
        defineTokenGraph({
          tokens: {
            danger: value,
          },
        }),
      ).toThrow(/unsupported color input/);
      expect(() =>
        defineTokenLayer({
          id: "application",
          tokens: {
            danger: value,
          },
        }),
      ).toThrow(/unsupported color input/);
    },
  );

  test("helper calls normalize supported strings into structured color values", () => {
    const graph = defineTokens({ brand: "oklch(0.7 0.12 265)" });
    expect(graph.tokens.brand).toEqual({ value: color("oklch(0.7 0.12 265)") });
  });

  test("accepts explicit helper and object references", () => {
    const graph = defineTokenGraph({
      tokens: {
        "brand.primary": "#6750a4",
        "app.action": tokenRef("brand.primary"),
        "app.alias": { ref: "brand.primary" },
      },
    });

    const compiled = unwrap(compileTokenGraph(graph));
    expect(compiled.tokens["app.action"]?.dependenciesByMode.base).toEqual(["brand.primary"]);
    expect(compiled.tokens["app.alias"]?.dependenciesByMode.base).toEqual(["brand.primary"]);
  });

  test("defines semantic tokens as public product tokens", () => {
    const graph = defineTokenGraph({
      modes: ["light", "dark"],
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
      },
      semanticTokens: {
        primary: { value: tokenRef("brand.primary") },
        "primary-foreground": { value: tokenRef("brand.on-primary") },
      },
    });

    expect(graph.semanticTokens).toEqual({
      primary: { value: { ref: "brand.primary" } },
      "primary-foreground": { value: { ref: "brand.on-primary" } },
    });

    const compiled = unwrap(compileTokenGraph(graph));
    expect(Object.keys(compiled.tokens)).toEqual(["primary", "primary-foreground"]);
    expect(compiled.tokens.primary?.visibility).toBe("public");
    expect(compiled.tokens.primary?.dependenciesByMode.light).toEqual(["brand.primary"]);
    expect(compiled.tokens.primary?.origin).toEqual({
      kind: "semanticToken",
      origin: { kind: "graph" },
      target: "brand.primary",
    });

    const cssExport = unwrap(exportCssVars(compiled));
    expect(cssExport.variableByToken.primary).toBe("--primary");
    expect(cssExport.css).toContain("--primary: #6750a4;");
  });

  test("accepts direct semantic tokens without implementation tokens", () => {
    const graph = defineTokenGraph({
      modes: ["light", "dark"],
      defaultMode: "light",
      semanticTokens: {
        primary: {
          light: "#6750a4",
          dark: "#d0bcff",
        },
        "primary-foreground": {
          light: "#ffffff",
          dark: "#381e72",
        },
      },
    });

    expect(graph.tokens).toEqual({});
    const compiled = unwrap(compileTokenGraph(graph));
    expect(Object.keys(compiled.tokens)).toEqual(["primary", "primary-foreground"]);
    expect(compiled.tokens.primary?.origin).toEqual({
      kind: "semanticToken",
      origin: { kind: "graph" },
    });
  });

  test("semantic token references can target semantic tokens", () => {
    const graph = defineTokenGraph({
      defaultVisibility: "internal",
      tokens: {
        "brand.primary": "#6750a4",
      },
      semanticTokens: {
        primary: tokenRef("brand.primary"),
        action: tokenRef("primary"),
      },
    });

    const compiled = unwrap(compileTokenGraph(graph));
    expect(Object.keys(compiled.tokens)).toEqual(["action", "primary"]);
    expect(compiled.tokens.action?.dependenciesByMode.base).toEqual(["primary"]);
    expect(compiled.tokens.action?.valueByMode.base).toEqual(color("#6750a4"));
  });

  test("exact and all selections include semantic tokens by key", () => {
    const graph = defineTokenGraph({
      defaultVisibility: "internal",
      tokens: {
        "brand.primary": "#6750a4",
      },
      semanticTokens: {
        primary: tokenRef("brand.primary"),
      },
    });

    expect(Object.keys(unwrap(compileTokenGraph(graph)).tokens)).toEqual(["primary"]);
    expect(Object.keys(unwrap(compileTokenGraph(graph, { selection: "all" })).tokens)).toEqual([
      "brand.primary",
      "primary",
    ]);
    expect(
      Object.keys(unwrap(compileTokenGraph(graph, { selection: { keys: ["primary"] } })).tokens),
    ).toEqual(["primary"]);
  });

  test("semantic token diagnostics use precise semanticTokens paths", () => {
    expect(
      compileTokenGraph(
        defineTokenGraph({
          semanticTokens: {
            "Bad Key": "#6750a4",
          },
        }),
      ),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-token-key", path: "/semanticTokens/Bad Key" }],
    });

    expect(
      compileTokenGraph({
        kind: colorTokenGraphKind,
        formatVersion: 1,
        modes: ["base"],
        defaultMode: "base",
        defaultVisibility: "public",
        tokens: {},
        semanticTokens: {
          primary: { value: { ref: "Bad Key" } },
        },
      }),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-reference", path: "/semanticTokens/primary/value" }],
    });

    expect(
      compileTokenGraph(
        defineTokenGraph({
          semanticTokens: {
            primary: tokenRef("brand.primary"),
          },
        }),
      ),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "unknown-reference", path: "/semanticTokens/primary/value" }],
    });
  });

  test("semantic tokens reject implementation token key collisions and cycles across lanes", () => {
    expect(
      compileTokenGraph(
        defineTokenGraph({
          tokens: {
            primary: "#6750a4",
          },
          semanticTokens: {
            primary: "#ff3b30",
          },
        }),
      ),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "duplicate-token-key", path: "/semanticTokens/primary" }],
    });

    expect(
      compileTokenGraph(
        defineTokenGraph({
          tokens: {
            "brand.primary": tokenRef("primary"),
          },
          semanticTokens: {
            primary: tokenRef("brand.primary"),
          },
        }),
      ),
    ).toMatchObject({
      ok: false,
      issues: [
        {
          code: "reference-cycle",
          cycle: ["brand.primary", "primary"],
          path: "/tokens/brand.primary/value",
        },
      ],
    });
  });

  test("reports unresolved explicit references at the reference path", () => {
    expect(
      compileTokenGraph(
        defineTokenGraph({
          tokens: {
            "app.action": tokenRef("brand.primary"),
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
      "defineTokenGraph input must include tokens, aliases, or semanticTokens.",
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
          value: tokenRef("material3.on-surface"),
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

    const themeCssExport = exportCssVars(compiled, { prefix: "theme" });
    expect(themeCssExport).toEqual({
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

    const defaultCssExport = exportCssVars(compiled);
    expect(defaultCssExport).toEqual({
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
    expect(unwrap(defaultCssExport).css).not.toContain("--color-");
    expect(unwrap(defaultCssExport).css).not.toContain("--scheme-");
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

    const cssExport = unwrap(exportCssVars(compiled, options));

    expect(cssExport.blocks.map((block) => block.selector)).toEqual([":root", ".dark"]);
    expect(cssExport.css).toBe(
      ":root {\n" +
        "  --app--action: #6750a4;\n" +
        "  --app--action-text: #ffffff;\n" +
        "}\n\n" +
        ".dark {\n" +
        "  --app--action: #d0bcff;\n" +
        "  --app--action-text: #381e72;\n" +
        "}\n",
    );
    expect(cssExport.css).toContain(`${cssExport.blocks[0]?.declarations[0]?.property}:`);
  });

  test("rejects unknown and missing mode selector strategy keys", () => {
    const compiled = unwrap(compileTokenGraph(makeGraph()));

    expect(
      exportCssVars(compiled, {
        modeSelectors: {
          strategy: "data-attribute",
          attribute: "data-theme",
          attrbute: "oops",
        } as never,
      }),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-mode-selectors" }],
    });

    expect(
      exportCssVars(compiled, {
        modeSelectors: { strategy: "class", classPrefix: "theme-", extra: true } as never,
      }),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-mode-selectors" }],
    });

    expect(
      exportCssVars(compiled, {
        modeSelectors: {
          strategy: "selectors",
          selectors: {
            light: ":root",
            dark: ".dark",
          },
          extra: true,
        } as never,
      }),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-mode-selectors" }],
    });

    expect(
      exportCssVars(compiled, {
        modeSelectors: { strategy: "selectors" } as never,
      }),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-mode-selectors" }],
    });
  });

  test("rejects unsafe generated selectors and exact selector collisions", () => {
    const compiled = unwrap(compileTokenGraph(makeGraph()));

    expect(
      exportCssVars(compiled, {
        scope: { strategy: "selector", selector: ".preview .panel" },
      }),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-scope" }],
    });

    expect(
      exportCssVars(compiled, {
        scope: { strategy: "selector", selector: ".preview::before" },
      }),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-scope" }],
    });

    expect(
      exportCssVars(compiled, {
        scope: { strategy: "selector", selector: ".preview, .other" },
      }),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-scope" }],
    });

    expect(
      exportCssVars(compiled, {
        modeSelectors: { strategy: "data-attribute", attribute: "aria-theme" },
      }),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-data-attribute" }],
    });

    expect(
      exportCssVars(compiled, {
        modeSelectors: { strategy: "class", classPrefix: "Theme-" },
      }),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-class-prefix" }],
    });

    expect(
      exportCssVars(compiled, {
        modeSelectors: {
          strategy: "selectors",
          selectors: {
            light: ".theme",
            dark: ".theme",
          },
        },
      }),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "duplicate-mode-selector" }],
    });

    expect(
      exportCssVars(compiled, {
        modeSelectors: {
          strategy: "selectors",
          selectors: {
            light: ".theme, .light",
            dark: ".dark",
          },
        },
      }),
    ).toMatchObject({
      ok: true,
      value: {
        blocks: [{ selector: ".theme, .light" }, { selector: ".dark" }],
      },
    });
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
            "brand.alias": tokenRef("brand.primary"),
            "app.action": tokenRef("brand.alias"),
          },
        }),
      ),
    );

    expect(compiled.tokens["app.action"]?.dependenciesByMode.base).toEqual(["brand.alias"]);
    expect(compiled.tokens["brand.alias"]?.dependenciesByMode.base).toEqual(["brand.primary"]);
  });

  test("compiled origin parser accepts only exact origin shapes", () => {
    const compiled = JSON.parse(
      serializeCompiledScheme(
        unwrap(
          compileTokenGraph(
            defineTokenGraph({
              tokens: {
                primary: "#6750a4",
              },
            }),
          ),
        ),
      ),
    ) as {
      tokens: {
        primary: {
          origin: unknown;
        };
      };
    };

    compiled.tokens.primary.origin = { kind: "graph", extra: true };
    expect(parseCompiledScheme(compiled)).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-origin" }],
    });

    compiled.tokens.primary.origin = { kind: "layer" };
    expect(parseCompiledScheme(compiled)).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-origin" }],
    });

    compiled.tokens.primary.origin = { kind: "layer", id: "brand", extra: true };
    expect(parseCompiledScheme(compiled)).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-origin" }],
    });

    compiled.tokens.primary.origin = { kind: "source", id: "material", sourceToken: "Bad Key" };
    expect(parseCompiledScheme(compiled)).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-origin" }],
    });

    compiled.tokens.primary.origin = {
      kind: "source",
      id: "material",
      sourceToken: "material.primary",
    };
    expect(parseCompiledScheme(compiled)).toMatchObject({ ok: true });

    compiled.tokens.primary.origin = {
      kind: "semanticToken",
      origin: { kind: "graph" },
      target: "Bad Key",
    };
    expect(parseCompiledScheme(compiled)).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-origin" }],
    });

    compiled.tokens.primary.origin = {
      kind: "semanticToken",
      origin: { kind: "graph" },
      target: "brand.primary",
    };
    expect(parseCompiledScheme(compiled)).toMatchObject({ ok: true });
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
            background: tokenRef("primary"),
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
        background: tokenRef("material3.surface"),
        foreground: tokenRef("material3.on-surface"),
        primary: tokenRef("material3.primary"),
        "primary-foreground": tokenRef("material3.on-primary"),
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
        "app.action": tokenRef("company.primary"),
      },
    });

    const value = unwrap(buildScheme(source, { layers: [app] }));

    expect(Object.keys(value.tokens)).toEqual(["app.action"]);
    expect(value.tokens["app.action"]?.origin).toEqual({
      kind: "layer",
      id: "application",
    });
  });

  test("buildScheme maps internal source roles through layer semantic tokens", () => {
    const material = fixedSource(
      "material",
      defineTokenGraph({
        modes: ["light", "dark"],
        defaultMode: "light",
        defaultVisibility: "internal",
        tokens: {
          "material3.surface": {
            light: "#fffbff",
            dark: "#141218",
          },
          "material3.on-surface": {
            light: "#1d1b20",
            dark: "#e6e0e9",
          },
          "material3.primary": {
            light: "#6750a4",
            dark: "#d0bcff",
          },
        },
      }),
    );
    const application = defineTokenLayer<"light" | "dark">({
      id: "application",
      semanticTokens: {
        background: { value: tokenRef("material3.surface") },
        foreground: { value: tokenRef("material3.on-surface") },
        primary: { value: tokenRef("material3.primary") },
      },
    });

    const value = unwrap(buildScheme(material, { layers: [application] }));

    expect(Object.keys(value.tokens)).toEqual(["background", "foreground", "primary"]);
    expect(value.tokens.background?.origin).toEqual({
      kind: "semanticToken",
      origin: { kind: "layer", id: "application" },
      target: "material3.surface",
    });
    expect(value.tokens.background?.dependenciesByMode.light).toEqual(["material3.surface"]);
    expect(unwrap(exportCssVars(value)).variableByToken.background).toBe("--background");
  });

  test("later layers deterministically override earlier semantic tokens", () => {
    const foundation = defineTokenLayer({
      id: "foundation",
      defaultVisibility: "internal",
      tokens: {
        "brand.primary": "#6750a4",
        "brand.secondary": "#006a60",
      },
      semanticTokens: {
        primary: tokenRef("brand.primary"),
      },
    });
    const product = defineTokenLayer({
      id: "product",
      semanticTokens: {
        primary: tokenRef("brand.secondary"),
      },
    });

    const value = unwrap(buildScheme({ layers: [foundation, product] }));

    expect(Object.keys(value.tokens)).toEqual(["primary"]);
    expect(value.tokens.primary?.valueByMode.base).toEqual(color("#006a60"));
    expect(value.tokens.primary?.origin).toEqual({
      kind: "semanticToken",
      origin: { kind: "layer", id: "product" },
      target: "brand.secondary",
    });
  });

  test("layers reject semantic token collisions with implementation tokens", () => {
    const foundation = defineTokenLayer({
      id: "foundation",
      semanticTokens: {
        primary: "#6750a4",
      },
    });
    const product = defineTokenLayer({
      id: "product",
      tokens: {
        primary: "#ff3b30",
      },
    });

    expect(buildScheme({ layers: [foundation, product] })).toMatchObject({
      ok: false,
      issues: [{ code: "duplicate-token-key", path: "/layers/1/tokens/primary" }],
    });
  });

  test("buildScheme lets layers override source tokens", () => {
    const source = fixedSource(
      "material",
      defineTokenGraph({
        tokens: {
          primary: "#6750a4",
          background: tokenRef("primary"),
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
            semanticTokens: {
              "semantic.action": tokenRef("palette.primary"),
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
      kind: "semanticToken",
      origin: { kind: "source", id: "semantic" },
      target: "palette.primary",
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
          "semantic.action": tokenRef("palette.primary"),
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
          "semantic.action": tokenRef("palette.primary"),
        },
      }),
    );
    const app = defineTokenLayer({
      id: "application",
      tokens: {
        "app.action": tokenRef("semantic.action"),
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
              light: tokenRef("first.token"),
              dark: tokenRef("first.token"),
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
          "semantic.action": tokenRef("palette.primary"),
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

  test("array readers reject sparse, accessor, proxy, and array-like parser input", () => {
    const sparseModes = ["base"];
    delete sparseModes[0];
    expect(() =>
      parseTokenGraph({
        kind: colorTokenGraphKind,
        formatVersion: 1,
        modes: sparseModes,
        defaultMode: "base",
        defaultVisibility: "public",
        tokens: {},
      }),
    ).not.toThrow();
    expect(
      parseTokenGraph({
        kind: colorTokenGraphKind,
        formatVersion: 1,
        modes: sparseModes,
        defaultMode: "base",
        defaultVisibility: "public",
        tokens: {},
      }),
    ).toMatchObject({ ok: false, issues: [{ code: "invalid-mode-key" }] });

    const accessorComponents = [1, 1, 1];
    Object.defineProperty(accessorComponents, "1", {
      enumerable: true,
      get() {
        throw new Error("component getter should not run");
      },
    });
    expect(() =>
      parseColor({ colorSpace: "srgb", components: accessorComponents, alpha: 1 }),
    ).not.toThrow();
    expect(
      parseColor({ colorSpace: "srgb", components: accessorComponents, alpha: 1 }),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-color-components" }],
    });

    const proxyModes = new Proxy(["base"], {
      ownKeys() {
        throw new Error("array trap should be contained");
      },
    });
    expect(() =>
      parseTokenGraph({
        kind: colorTokenGraphKind,
        formatVersion: 1,
        modes: proxyModes,
        defaultMode: "base",
        defaultVisibility: "public",
        tokens: {},
      }),
    ).not.toThrow();

    expect(
      parseTokenGraph({
        kind: colorTokenGraphKind,
        formatVersion: 1,
        modes: { 0: "base", length: 1 },
        defaultMode: "base",
        defaultVisibility: "public",
        tokens: {},
      }),
    ).toMatchObject({ ok: false, issues: [{ code: "invalid-mode-key" }] });

    let graphLayerGetterRan = false;
    const accessorGraphLayers = [
      defineTokenLayer({
        id: "application",
        tokens: {},
      }),
    ];
    Object.defineProperty(accessorGraphLayers, "0", {
      enumerable: true,
      get() {
        graphLayerGetterRan = true;
        throw new Error("graph layer getter should not run");
      },
    });
    expect(() =>
      parseTokenGraph({
        kind: colorTokenGraphKind,
        formatVersion: 1,
        modes: ["base"],
        defaultMode: "base",
        defaultVisibility: "public",
        tokens: {},
        layers: accessorGraphLayers,
      }),
    ).not.toThrow();
    expect(graphLayerGetterRan).toBe(false);
    expect(
      parseTokenGraph({
        kind: colorTokenGraphKind,
        formatVersion: 1,
        modes: ["base"],
        defaultMode: "base",
        defaultVisibility: "public",
        tokens: {},
        layers: accessorGraphLayers,
      }),
    ).toMatchObject({ ok: false, issues: [{ code: "invalid-object" }] });

    const source = fixedSource(
      "source",
      defineTokenGraph({
        tokens: {
          primary: "#6750a4",
        },
      }),
    );
    const sparseBase = [source];
    delete sparseBase[0];
    expect(() => buildScheme({ base: sparseBase })).not.toThrow();
    expect(buildScheme({ base: sparseBase })).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-build-options" }],
    });

    let callerLayerGetterRan = false;
    const accessorCallerLayers = [
      defineTokenLayer({
        id: "application",
        tokens: {},
      }),
    ];
    Object.defineProperty(accessorCallerLayers, "0", {
      enumerable: true,
      get() {
        callerLayerGetterRan = true;
        throw new Error("caller layer getter should not run");
      },
    });
    expect(() => buildScheme({ layers: accessorCallerLayers })).not.toThrow();
    expect(callerLayerGetterRan).toBe(false);
    expect(buildScheme({ layers: accessorCallerLayers })).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-build-options" }],
    });

    const proxySourceLayers = new Proxy(
      [
        defineTokenLayer({
          id: "application",
          tokens: {},
        }),
      ],
      {
        ownKeys() {
          throw new Error("source graph layers trap should be contained");
        },
      },
    );
    expect(() =>
      buildScheme({
        base: [
          fixedSource("source-with-layers", {
            ...defineTokenGraph({
              tokens: {
                primary: "#6750a4",
              },
            }),
            layers: proxySourceLayers,
          }),
        ],
      }),
    ).not.toThrow();
    expect(
      buildScheme({
        base: [
          fixedSource("source-with-layers", {
            ...defineTokenGraph({
              tokens: {
                primary: "#6750a4",
              },
            }),
            layers: proxySourceLayers,
          }),
        ],
      }),
    ).toMatchObject({ ok: false, issues: [{ code: "invalid-object" }] });

    const compiled = JSON.parse(
      serializeCompiledScheme(
        unwrap(
          compileTokenGraph(
            defineTokenGraph({
              tokens: {
                primary: "#6750a4",
              },
            }),
          ),
        ),
      ),
    ) as {
      modes: unknown;
      tokens: {
        primary: {
          dependenciesByMode: {
            base: unknown;
          };
        };
      };
    };
    const compiledWithProxyModes = {
      ...compiled,
      modes: new Proxy(["base"], {
        getOwnPropertyDescriptor() {
          throw new Error("compiled modes trap should be contained");
        },
      }),
    };
    expect(() => parseCompiledScheme(compiledWithProxyModes)).not.toThrow();
    const proxyModesResult = parseCompiledScheme(compiledWithProxyModes);
    expect(proxyModesResult.ok).toBe(false);
    if (proxyModesResult.ok) {
      throw new Error("Expected compiled proxy modes to fail.");
    }
    expect(proxyModesResult.issues).toContainEqual(
      expect.objectContaining({ code: "invalid-mode-key" }),
    );

    compiled.tokens.primary.dependenciesByMode.base = new Proxy(["primary"], {
      getOwnPropertyDescriptor() {
        throw new Error("dependency trap should be contained");
      },
    });
    expect(() => parseCompiledScheme(compiled)).not.toThrow();
    expect(parseCompiledScheme(compiled)).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-dependencies" }],
    });
  });
});
