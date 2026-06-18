import { describe, expect, it } from "vitest";
import {
  compileGraph,
  darkMode,
  exportCssVariables,
  hex,
  lightMode,
  literalColor,
  serializeTokenSet,
  tokenKey,
  validateGraph,
  type ColorSchemeTokenGraph,
  type ModeKey,
  type TokenNode,
} from "../src/index";

describe("graph core", () => {
  it("validates, compiles, serializes, and exports a small graph", () => {
    const graph = testGraph({
      modes: [lightMode, darkMode],
      tokens: [
        {
          kind: "color",
          key: tokenKey("scheme.primary"),
          values: [
            { mode: lightMode, value: literalColor(hex("#6750a4")) },
            { mode: darkMode, value: literalColor(hex("#d0bcff")) },
          ],
        },
        {
          kind: "alias",
          key: tokenKey("app.action"),
          target: tokenKey("scheme.primary"),
        },
      ],
    });

    expect(validateGraph(graph).ok).toBe(true);

    const compiled = compileGraph(graph);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    expect(serializeTokenSet(compiled.value)).toContain('"key": "app.action"');
    expect(exportCssVariables(compiled.value)).toContain("--app-action: #6750a4;");
    expect(exportCssVariables(compiled.value)).toContain("--scheme-primary: #d0bcff;");
  });

  it("keeps color token values at the authored graph boundary and compiles concrete colors", () => {
    const graph = testGraph({
      tokens: [
        {
          kind: "color",
          key: tokenKey("scheme.primary"),
          values: [
            { mode: lightMode, value: literalColor(hex("#6750a4")) },
            { mode: darkMode, value: literalColor(hex("#d0bcff")) },
          ],
        },
      ],
    });

    const compiled = compileGraph(graph);

    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    expect(compiled.value.tokens[0]?.values[0]?.value).toEqual(hex("#6750a4"));
  });

  it("returns validation problems for mode-specific alias cycles", () => {
    const graph = testGraph({
      modes: [lightMode, darkMode],
      tokens: [
        {
          kind: "alias",
          key: tokenKey("app.one"),
          target: tokenKey("app.two"),
        },
        {
          kind: "alias",
          key: tokenKey("app.two"),
          target: tokenKey("app.one"),
        },
      ],
    });

    const result = validateGraph(graph);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.some((problem) => problem.kind === "alias-cycle")).toBe(true);
  });
});

function testGraph(options: {
  readonly modes?: readonly ModeKey[];
  readonly tokens?: readonly TokenNode[];
}): ColorSchemeTokenGraph {
  return {
    schemaVersion: "color-scheme-token-graph/v0",
    modes: [...(options.modes ?? [lightMode, darkMode])],
    tokens: [...(options.tokens ?? [])],
  };
}
