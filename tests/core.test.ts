import { describe, expect, it } from "vitest";
import {
  compileGraph,
  compileValidatedGraph,
  exportCssVariables,
  hex,
  serializeTokenSet,
  validateGraph,
  type ColorSchemeTokenGraphInput,
  type TokenNodeInput,
} from "../src/index";

describe("graph core", () => {
  it("accepts plain string keys and modes at the authored graph boundary", () => {
    const graph = testGraph({
      modes: ["light", "dark"],
      tokens: [
        {
          kind: "color",
          key: "brand.primary",
          values: [
            { mode: "light", value: "#6750a4" },
            { mode: "dark", value: "#d0bcff" },
          ],
        },
        {
          kind: "alias",
          key: "app.action",
          target: "brand.primary",
        },
      ],
    });

    expect(validateGraph(graph).ok).toBe(true);

    const compiled = compileGraph(graph);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    expect(serializeTokenSet(compiled.value)).toContain('"key": "app.action"');
    expect(exportCssVariables(compiled.value)).toContain("--app-action: #6750a4;");
    expect(exportCssVariables(compiled.value)).toContain("--brand-primary: #d0bcff;");
  });

  it("returns structured problems for invalid token keys without throwing", () => {
    const result = validateGraph(
      testGraph({
        tokens: [
          {
            kind: "color",
            key: "brand",
            values: [
              { mode: "light", value: "#6750a4" },
              { mode: "dark", value: "#d0bcff" },
            ],
          },
        ],
      }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems).toContainEqual(
      expect.objectContaining({ kind: "invalid-token-key", key: "brand" }),
    );
  });

  it("returns structured problems for invalid mode keys without throwing", () => {
    const result = validateGraph(
      testGraph({
        modes: ["light", "dark-mode"],
      }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems).toContainEqual(
      expect.objectContaining({ kind: "invalid-mode-key", mode: "dark-mode" }),
    );
  });

  it("accepts raw color strings at the authored graph boundary and compiles concrete colors", () => {
    const graph = testGraph({
      tokens: [
        {
          kind: "color",
          key: "brand.primary",
          values: [
            { mode: "light", value: "#6750a4" },
            { mode: "dark", value: "#d0bcff" },
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
      modes: ["light", "dark"],
      tokens: [
        {
          kind: "alias",
          key: "app.one",
          target: "app.two",
        },
        {
          kind: "alias",
          key: "app.two",
          target: "app.one",
        },
      ],
    });

    const result = validateGraph(graph);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.some((problem) => problem.kind === "alias-cycle")).toBe(true);
  });

  it("returns structured problems for invalid color strings without throwing", () => {
    const result = validateGraph(
      testGraph({
        tokens: [
          {
            kind: "color",
            key: "brand.primary",
            values: [
              { mode: "light", value: "not-a-color" },
              { mode: "dark", value: "#d0bcff" },
            ],
          },
        ],
      }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems).toContainEqual(
      expect.objectContaining({
        kind: "invalid-color-input",
        key: "brand.primary",
        path: "tokens.0.values.0.value",
      }),
    );
  });

  it("compiles already validated graphs without validating schema again", () => {
    const validation = validateGraph(
      testGraph({
        tokens: [
          {
            kind: "color",
            key: "brand.primary",
            values: [
              { mode: "light", value: "#6750a4" },
              { mode: "dark", value: "#d0bcff" },
            ],
          },
        ],
      }),
    );

    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    const alreadyValidated = {
      ...validation.value,
      schemaVersion: "not-the-input-schema",
    } as unknown as typeof validation.value;
    const compiled = compileValidatedGraph(alreadyValidated);

    expect(compiled.ok).toBe(true);
  });
});

function testGraph(options: {
  readonly modes?: readonly string[];
  readonly tokens?: readonly TokenNodeInput[];
}): ColorSchemeTokenGraphInput {
  return {
    schemaVersion: "color-scheme-token-graph/v0",
    modes: [...(options.modes ?? ["light", "dark"])],
    tokens: [...(options.tokens ?? [])],
  };
}
