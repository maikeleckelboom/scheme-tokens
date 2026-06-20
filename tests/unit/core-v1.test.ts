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
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
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
      formatVersion: 1,
      modes: ["dark", "light"],
      defaultMode: "light",
      defaultVisibility: "internal",
      tokens: {
        "brand.primary": {
          valueByMode: {
            light: "#6750a4",
            dark: "#d0bcff",
          },
        },
        "brand.on-primary": {
          valueByMode: {
            light: "#ffffff",
            dark: "#381e72",
          },
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

    const css = exportCssVariables(compiled, { variablePrefix: "theme" });
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
      issues: [{ code: "reference-cycle", cycle: ["a.one", "a.two"] }],
    });
  });
});

describe("v1 sources", () => {
  test("buildTokenSet calls a source once and composes caller fragments", () => {
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

    const value = unwrap(buildTokenSet({ source, fragments: [app] }));
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
});
