import { describe, expect, it } from "vitest";
import { compileValidatedGraph, createSourceGraph, hex } from "../../src/index";
import { material3Source } from "../../src/sources/material3";

describe("material3Source", () => {
  it("generates the reconciled required Material 3 role inventory as m3 tokens", () => {
    const source = material3Source({ color: "#6750A4" });
    const requiredRoles = source.roleSet.roles.filter((role) => role.required);
    const optionalRoles = source.roleSet.roles.filter((role) => !role.required);
    const graph = expectOk(createSourceGraph({ source }));

    expect(requiredRoles).toHaveLength(55);
    expect(optionalRoles).toHaveLength(4);
    expect(Object.prototype.hasOwnProperty.call(source, "defaults")).toBe(false);
    expect(graph.tokens).toHaveLength(59);
    expect(graph.tokens.every((token) => String(token.key).startsWith("m3."))).toBe(true);
    expect(graph.tokens.some((token) => String(token.key).startsWith("material."))).toBe(false);

    const compiled = expectOk(compileValidatedGraph(graph));
    expect(compiled.tokens.find((token) => token.key === "m3.primary")).toEqual(definedToken());
  });

  it("includes optional dim roles symmetrically when the upstream source provides them", () => {
    const graph = expectOk(
      createSourceGraph({
        source: material3Source({
          color: "#6750A4",
          algorithm: { specVersion: "2025", platform: "phone" },
        }),
      }),
    );

    for (const key of ["m3.primaryDim", "m3.secondaryDim", "m3.tertiaryDim", "m3.errorDim"]) {
      const token = expectColorToken(graph.tokens.find((candidate) => candidate.key === key));
      expect(token.values.map((entry) => String(entry.mode))).toEqual(["light", "dark"]);
    }
  });

  it("rejects non-opaque and non-srgb source colors with structured source problems", () => {
    const alphaResult = material3Source({
      color: { ...hex("#6750A4"), alpha: 0.5 },
    }).createGraph();
    const wideColorResult = material3Source({
      color: {
        colorSpace: "display-p3",
        r: 0.4,
        g: 0.31,
        b: 0.64,
        alpha: 1,
      } as never,
    }).createGraph();

    expect(
      expectProblems(alphaResult).some((problem) => problem.kind === "unsupported-alpha"),
    ).toBe(true);
    expect(
      expectProblems(wideColorResult).some(
        (problem) => problem.kind === "unsupported-source-color",
      ),
    ).toBe(true);
  });

  it("rejects invalid source color strings with structured source problems", () => {
    const result = material3Source({ color: "not-a-color" }).createGraph();

    expect(expectProblems(result)).toContainEqual(
      expect.objectContaining({
        kind: "invalid-color-input",
        path: "color",
      }),
    );
  });

  it("keeps algorithm options adapter-specific", () => {
    const result = material3Source({
      color: "#6750A4",
      algorithm: {
        contrastLevel: 0.25,
        variant: "tonalSpot",
        specVersion: "2021",
        platform: "phone",
      },
    }).createGraph();

    expect(result.ok).toBe(true);
  });

  it("rejects invalid algorithm options before generation", () => {
    const result = material3Source({
      color: "#6750A4",
      algorithm: { contrastLevel: 1.5 },
    }).createGraph();

    expect(expectProblems(result)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "invalid-contrast-level",
          path: "algorithm.contrastLevel",
        }),
      ]),
    );
  });

  it("uses optional key colors to override Material 3 palettes", () => {
    const defaultGraph = expectOk(
      createSourceGraph({
        source: material3Source({ color: "#6750A4" }),
      }),
    );
    const keyedGraph = expectOk(
      createSourceGraph({
        source: material3Source({
          color: "#6750A4",
          keyColors: {
            primary: "#006C4C",
          },
        }),
      }),
    );

    const defaultPrimary = expectColorToken(
      defaultGraph.tokens.find((candidate) => candidate.key === "m3.primary"),
    );
    const keyedPrimary = expectColorToken(
      keyedGraph.tokens.find((candidate) => candidate.key === "m3.primary"),
    );

    expect(keyedPrimary.values).not.toEqual(defaultPrimary.values);
  });

  it("accepts Material key colors as strings", () => {
    const result = material3Source({
      color: "#6750A4",
      keyColors: {
        primary: "#6750A4",
        secondary: "#625B71",
        tertiary: "#7D5260",
        neutral: "#605D62",
        neutralVariant: "#605D66",
      },
    }).createGraph();

    expect(result.ok).toBe(true);
  });
});

function definedToken(): unknown {
  return expect.objectContaining({
    key: "m3.primary",
    values: expect.any(Array),
  });
}

function expectColorToken<Token extends { readonly kind: string } | undefined>(
  token: Token,
): Extract<Token, { readonly kind: "color" }> {
  expect(token?.kind).toBe("color");
  if (token?.kind !== "color") throw new Error("Expected color token.");
  return token as Extract<Token, { readonly kind: "color" }>;
}

function expectOk<Value, Problem>(
  result:
    | { readonly ok: true; readonly value: Value }
    | { readonly ok: false; readonly problems: readonly Problem[] },
): Value {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(JSON.stringify(result.problems));
  return result.value;
}

function expectProblems<Value, Problem>(
  result:
    | { readonly ok: true; readonly value: Value }
    | { readonly ok: false; readonly problems: readonly Problem[] },
): readonly Problem[] {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("Expected result to fail.");
  return result.problems;
}
