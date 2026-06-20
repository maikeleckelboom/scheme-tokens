import { describe, expect, test } from "vitest";
import {
  buildTokenSet,
  compileTokenGraph,
  defineTokenFragment,
  defineTokenGraph,
  exportCssVariables,
  formatCssColor,
  parseColor,
  parseTokenGraph,
  serializeTokenSet,
  type Issue,
  type Result,
  type TokenGraphInput,
  type TokenSource,
} from "../../src";

function unwrap<Value>(result: Result<Value, Issue>): Value {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(JSON.stringify(result.issues));
  }
  return result.value;
}

function fixedSource(id: string, graph: unknown): TokenSource {
  return {
    id,
    build(): Result<TokenGraphInput, Issue> {
      return { ok: true, value: graph as TokenGraphInput };
    },
  };
}

function strictSourceGraph(
  tokenKey: string,
  overrides: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    formatVersion: 1,
    modes: ["base"],
    defaultMode: "base",
    defaultVisibility: "public",
    tokens: {
      [tokenKey]: { value: "#ffffff" },
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
      value: { colorSpace: "srgb", r: 1, g: 1, b: 1, alpha: 0.5333333333333333 },
    });

    const extended = parseColor({ colorSpace: "srgb", r: 1.08, g: 0.12, b: -0.03 });
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
        "app.foreground": { ref: "app.background" },
      },
    });

    expect(graph).toEqual({
      formatVersion: 1,
      modes: ["base"],
      defaultMode: "base",
      defaultVisibility: "public",
      tokens: {
        "app.background": { value: "#ffffff" },
        "app.foreground": { value: { ref: "app.background" } },
      },
    });

    const compiled = unwrap(compileTokenGraph(graph));
    expect(Object.keys(compiled.tokens)).toEqual(["app.background", "app.foreground"]);
    expect(compiled.tokens["app.foreground"]?.dependenciesByMode.base).toEqual(["app.background"]);
  });

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
  });

  test("parses to an owned canonical graph", () => {
    const graph = makeGraph();
    const parsed = unwrap(parseTokenGraph(graph));

    expect(parsed.modes).toEqual(["light", "dark"]);
    expect(parsed.tokens["app.action"]?.visibility).toBe("public");

    (graph as never as { tokens: { "brand.primary": { valueByMode: { light: string } } } }).tokens[
      "brand.primary"
    ].valueByMode.light = "#000000";
    expect(parsed.tokens["brand.primary"]?.valueByMode.light).toEqual({
      colorSpace: "srgb",
      r: 0.403921568627451,
      g: 0.3137254901960784,
      b: 0.6431372549019608,
      alpha: 1,
    });
  });

  test("compiles public selection, dependencies, CSS, and canonical JSON", () => {
    const graph = makeGraph();
    const compiled = unwrap(compileTokenGraph(graph));

    expect(Object.keys(compiled.tokens)).toEqual(["app.action", "app.action-text"]);
    expect(compiled.tokens["app.action"]?.dependenciesByMode.light).toEqual(["brand.primary"]);

    const css = exportCssVariables(compiled, { prefix: "theme" });
    expect(css).toEqual({
      ok: true,
      value:
        ":root {\n" +
        "  --theme--app--action: #6750a4;\n" +
        "  --theme--app--action-text: #ffffff;\n" +
        "}\n\n" +
        ':root[data-color-scheme="dark"] {\n' +
        "  --theme--app--action: #d0bcff;\n" +
        "  --theme--app--action-text: #381e72;\n" +
        "}\n",
    });

    expect(serializeTokenSet(compiled)).toContain('"formatVersion": 1');
    expect(serializeTokenSet(compiled).endsWith("\n")).toBe(true);
  });

  test("rejects the removed CSS variablePrefix option at runtime", () => {
    const compiled = unwrap(compileTokenGraph(makeGraph()));
    const oldOptions: unknown = { variablePrefix: "theme" };

    expect(exportCssVariables(compiled, oldOptions as never)).toEqual({
      ok: false,
      issues: [{ code: "invalid-css-options", message: "Unknown CSS option: variablePrefix." }],
    });
  });

  test("rejects invalid CSS prefixes with the release-safe issue code", () => {
    const compiled = unwrap(compileTokenGraph(makeGraph()));

    expect(exportCssVariables(compiled, { prefix: "Theme" })).toEqual({
      ok: false,
      issues: [
        {
          code: "invalid-css-prefix",
          message: "prefix must be a lower-kebab single segment.",
        },
      ],
    });
  });

  test("stores direct dependencies without expanding transitive chains", () => {
    const compiled = unwrap(
      compileTokenGraph({
        formatVersion: 1,
        modes: ["base"],
        defaultMode: "base",
        defaultVisibility: "public",
        tokens: {
          "brand.primary": { value: "#6750a4" },
          "brand.alias": { value: { ref: "brand.primary" } },
          "app.action": { value: { ref: "brand.alias" } },
        },
      }),
    );

    expect(compiled.tokens["app.action"]?.dependenciesByMode.base).toEqual(["brand.alias"]);
    expect(compiled.tokens["brand.alias"]?.dependenciesByMode.base).toEqual(["brand.primary"]);
  });

  test("reports duplicate fragments, exact-selection issues, and cycles", () => {
    const graph = makeGraph();
    const fragment = defineTokenFragment({
      formatVersion: 1,
      id: "brand",
      defaultVisibility: "public",
      tokens: {
        "app.action": { value: "#000" },
      },
    });
    expect(compileTokenGraph({ ...graph, fragments: [fragment] })).toMatchObject({
      ok: false,
      issues: [{ code: "duplicate-token-key" }],
    });

    expect(compileTokenGraph(graph, { selection: { keys: [] } })).toMatchObject({
      ok: false,
      issues: [{ code: "empty-selection" }],
    });

    expect(
      compileTokenGraph({
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

  test("reports precise JSON Pointer paths for references", () => {
    expect(
      parseTokenGraph({
        formatVersion: 1,
        modes: ["light", "dark"],
        defaultMode: "light",
        defaultVisibility: "public",
        tokens: {
          "app.action": {
            valueByMode: {
              light: { ref: "missing.light" },
              dark: "#000000",
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
  test("buildTokenSet accepts one source through sources and composes caller fragments", () => {
    let calls = 0;
    interface CompanyIssue extends Issue<"missing-company-primary"> {}
    const source: TokenSource<CompanyIssue> = {
      id: "company",
      build(): Result<TokenGraphInput, CompanyIssue> {
        calls += 1;
        return {
          ok: true,
          value: {
            formatVersion: 1,
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
          },
        };
      },
    };

    const app = defineTokenFragment({
      formatVersion: 1,
      id: "application",
      defaultVisibility: "public",
      tokens: {
        "app.action": { value: { ref: "company.primary" } },
      },
    });

    const value = unwrap(buildTokenSet({ sources: [source], fragments: [app] }));
    expect(calls).toBe(1);
    expect(Object.keys(value.tokenSet.tokens)).toEqual(["app.action"]);
    expect(value.graph.tokens["company.primary"]?.origin).toEqual({
      kind: "source",
      id: "company",
    });
    expect(value.graph.tokens["app.action"]?.origin).toEqual({
      kind: "fragment",
      id: "application",
    });
  });

  test("buildTokenSet composes multiple sources in array order", () => {
    const palette: TokenSource = {
      id: "palette",
      build(): Result<TokenGraphInput, Issue> {
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
    const semantic: TokenSource = {
      id: "semantic",
      build(): Result<TokenGraphInput, Issue> {
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

    const value = unwrap(buildTokenSet({ sources: [palette, semantic] }));

    expect(Object.keys(value.tokenSet.tokens)).toEqual(["semantic.action"]);
    expect(value.graph.tokens["palette.primary"]?.origin).toEqual({
      kind: "source",
      id: "palette",
    });
    expect(value.graph.tokens["semantic.action"]?.origin).toEqual({
      kind: "source",
      id: "semantic",
    });
    expect(value.graph.tokens["palette.primary"]?.visibility).toBe("internal");
    expect(value.graph.tokens["semantic.action"]?.visibility).toBe("public");
    expect(value.tokenSet.tokens["semantic.action"]?.dependenciesByMode.base).toEqual([
      "palette.primary",
    ]);
  });

  test("buildTokenSet validates every source graph strict envelope before composition", () => {
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
    const invalidFragments = strictSourceGraph("bad.fragments", { fragments: {} });

    const scenarios = [
      {
        graph: strictSourceGraph("bad.format-version", { formatVersion: 2 }),
        issue: { code: "invalid-format-version", path: "/sources/1/formatVersion" },
      },
      {
        graph: withoutProperty(strictSourceGraph("bad.missing-format-version"), "formatVersion"),
        issue: { code: "missing-property", path: "/sources/1/formatVersion" },
      },
      {
        graph: invalidModes,
        issue: { code: "invalid-mode-key", path: "/sources/1/modes" },
      },
      {
        graph: missingModes,
        issue: { code: "missing-property", path: "/sources/1/modes" },
      },
      {
        graph: invalidDefaultMode,
        issue: { code: "default-mode-not-found", path: "/sources/1/defaultMode" },
      },
      {
        graph: missingDefaultMode,
        issue: { code: "missing-property", path: "/sources/1/defaultMode" },
      },
      {
        graph: invalidDefaultVisibility,
        issue: { code: "invalid-default-visibility", path: "/sources/1/defaultVisibility" },
      },
      {
        graph: missingDefaultVisibility,
        issue: { code: "invalid-default-visibility", path: "/sources/1/defaultVisibility" },
      },
      {
        graph: invalidTokens,
        issue: { code: "invalid-object", path: "/sources/1/tokens" },
      },
      {
        graph: missingTokens,
        issue: { code: "missing-property", path: "/sources/1/tokens" },
      },
      {
        graph: strictSourceGraph("bad.unknown", { unexpected: true }),
        issue: { code: "unknown-property", path: "/sources/1/unexpected" },
      },
      {
        graph: invalidFragments,
        issue: { code: "invalid-object", path: "/sources/1/fragments" },
      },
    ] as const;

    for (const scenario of scenarios) {
      expect(buildTokenSet({ sources: [valid, fixedSource("bad", scenario.graph)] })).toMatchObject(
        {
          ok: false,
          issues: [scenario.issue],
        },
      );
    }
  });

  test("buildTokenSet compares source modes by canonical semantics", () => {
    const first = fixedSource("first", {
      formatVersion: 1,
      modes: ["dark", "light"],
      defaultMode: "light",
      defaultVisibility: "public",
      tokens: {
        "first.token": {
          valueByMode: {
            light: "#ffffff",
            dark: "#000000",
          },
        },
      },
    });
    const second = fixedSource("second", {
      formatVersion: 1,
      modes: ["light", "dark"],
      defaultMode: "light",
      defaultVisibility: "public",
      tokens: {
        "second.token": {
          valueByMode: {
            light: { ref: "first.token" },
            dark: { ref: "first.token" },
          },
        },
      },
    });

    const value = unwrap(buildTokenSet({ sources: [first, second] }));

    expect(value.graph.modes).toEqual(["light", "dark"]);
    expect(Object.keys(value.tokenSet.tokens)).toEqual(["first.token", "second.token"]);
    expect(value.tokenSet.tokens["second.token"]?.dependenciesByMode.light).toEqual([
      "first.token",
    ]);
  });

  test("buildTokenSet rejects incompatible source mode sets and default modes", () => {
    const first = fixedSource("first", {
      formatVersion: 1,
      modes: ["light", "dark"],
      defaultMode: "light",
      defaultVisibility: "public",
      tokens: {
        "first.token": {
          valueByMode: {
            light: "#ffffff",
            dark: "#000000",
          },
        },
      },
    });
    const differentModeSet = fixedSource("second", {
      formatVersion: 1,
      modes: ["light", "dim"],
      defaultMode: "light",
      defaultVisibility: "public",
      tokens: {
        "second.token": {
          valueByMode: {
            light: "#ffffff",
            dim: "#eeeeee",
          },
        },
      },
    });
    const differentDefaultMode = fixedSource("third", {
      formatVersion: 1,
      modes: ["dark", "light"],
      defaultMode: "dark",
      defaultVisibility: "public",
      tokens: {
        "third.token": {
          valueByMode: {
            light: "#ffffff",
            dark: "#000000",
          },
        },
      },
    });

    expect(buildTokenSet({ sources: [first, differentModeSet] })).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-source-result", path: "/sources/1/modes" }],
    });
    expect(buildTokenSet({ sources: [first, differentDefaultMode] })).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-source-result", path: "/sources/1/defaultMode" }],
    });
  });

  test("buildTokenSet preserves source-local defaultVisibility and explicit visibility", () => {
    const palette = fixedSource("palette", {
      formatVersion: 1,
      modes: ["base"],
      defaultMode: "base",
      defaultVisibility: "internal",
      tokens: {
        "palette.primary": { value: "#1455d9" },
      },
    });
    const semantic = fixedSource("semantic", {
      formatVersion: 1,
      modes: ["base"],
      defaultMode: "base",
      defaultVisibility: "public",
      tokens: {
        "semantic.action": { value: { ref: "palette.primary" } },
        "semantic.hidden": { visibility: "internal", value: "#000000" },
      },
    });

    const value = unwrap(buildTokenSet({ sources: [palette, semantic] }));

    expect(value.graph.tokens["palette.primary"]?.visibility).toBe("internal");
    expect(value.graph.tokens["semantic.action"]?.visibility).toBe("public");
    expect(value.graph.tokens["semantic.hidden"]?.visibility).toBe("internal");
    expect(value.graph.tokens["palette.primary"]?.origin).toEqual({
      kind: "source",
      id: "palette",
    });
    expect(value.graph.tokens["semantic.action"]?.origin).toEqual({
      kind: "source",
      id: "semantic",
    });
    expect(Object.keys(value.tokenSet.tokens)).toEqual(["semantic.action"]);
  });

  test("buildTokenSet composes caller fragments after all sources", () => {
    const palette: TokenSource = {
      id: "palette",
      build(): Result<TokenGraphInput, Issue> {
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
    const semantic: TokenSource = {
      id: "semantic",
      build(): Result<TokenGraphInput, Issue> {
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
    const app = defineTokenFragment({
      id: "application",
      defaultVisibility: "public",
      tokens: {
        "app.action": { ref: "semantic.action" },
      },
    });

    const value = unwrap(buildTokenSet({ sources: [palette, semantic], fragments: [app] }));

    expect(Object.keys(value.tokenSet.tokens)).toEqual(["app.action"]);
    expect(value.graph.tokens["app.action"]?.origin).toEqual({
      kind: "fragment",
      id: "application",
    });
  });

  test("buildTokenSet accepts structural source metadata and preserves build receiver", () => {
    const source = {
      id: "brand",
      primary: "#1455d9",
      build(): Result<TokenGraphInput, Issue> {
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

    const built = unwrap(buildTokenSet({ sources: [source] }));

    expect(built.graph.tokens["brand.primary"]?.valueByMode.base).toEqual({
      colorSpace: "srgb",
      r: 0.0784313725490196,
      g: 0.3333333333333333,
      b: 0.8509803921568627,
      alpha: 1,
    });
  });

  test("buildTokenSet rejects missing, empty, and singular source options", () => {
    expect(buildTokenSet({} as never)).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-build-options", path: "/sources" }],
    });
    expect(buildTokenSet({ sources: [] } as never)).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-build-options", path: "/sources" }],
    });
    expect(
      buildTokenSet({
        source: {
          id: "brand",
          build: () => ({ ok: true, value: defineTokenGraph({ tokens: {} }) }),
        },
      } as never),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-build-options", message: "Unknown build option: source." }],
    });
  });

  test("buildTokenSet rejects duplicate source ids", () => {
    const source = {
      id: "brand",
      build: () => ({ ok: true as const, value: defineTokenGraph({ tokens: {} }) }),
    };

    expect(buildTokenSet({ sources: [source, source] })).toMatchObject({
      ok: false,
      issues: [
        {
          code: "duplicate-source-id",
          path: "/sources/1/id",
          sourceId: "brand",
          firstPath: "/sources/0/id",
        },
      ],
    });
  });

  test("buildTokenSet rejects duplicate token keys across sources", () => {
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

    expect(buildTokenSet({ sources: [first, second] })).toMatchObject({
      ok: false,
      issues: [
        {
          code: "duplicate-token-key",
          path: "/sources/1/tokens/brand.primary",
          firstPath: "/sources/0/tokens/brand.primary",
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
