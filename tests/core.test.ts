import { describe, expect, it } from "vitest";
import {
  compileGraph,
  createSchemeGraph,
  darkMode,
  exportCssVariables,
  hex,
  lightMode,
  serializeTokenSet,
  tokenKey,
  validateGraph,
} from "../src/index";

describe("graph core", () => {
  it("validates, compiles, serializes, and exports a small graph", () => {
    const graph = createSchemeGraph({
      modes: [lightMode, darkMode],
      tokens: [
        {
          kind: "color",
          key: tokenKey("scheme.primary"),
          value: [
            { mode: lightMode, value: hex("#6750a4") },
            { mode: darkMode, value: hex("#d0bcff") },
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

  it("returns validation problems for mode-specific alias cycles", () => {
    const graph = createSchemeGraph({
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
