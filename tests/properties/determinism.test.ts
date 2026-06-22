import fc from "fast-check";
import { describe, expect, test } from "vitest";
import {
  colorTokenGraphKind,
  compileTokenGraph,
  defineTokenGraph,
  parseTokenGraph,
  serializeCompiledScheme,
} from "../../src";

describe("determinism and parser safety properties", () => {
  test("parse boundaries do not throw for JSON values", () => {
    fc.assert(
      fc.property(fc.jsonValue(), (value) => {
        expect(() => parseTokenGraph(value)).not.toThrow();
      }),
      { numRuns: 100 },
    );
  });

  test("token insertion order does not change canonical serialization", () => {
    const left = compileTokenGraph(
      defineTokenGraph({
        modes: ["dark", "light"],
        defaultMode: "light",
        tokens: {
          "b.color": "#111111",
          "a.color": "#ffffff",
        },
      }),
    );
    const right = compileTokenGraph(
      defineTokenGraph({
        modes: ["light", "dark"],
        defaultMode: "light",
        tokens: {
          "a.color": "#ffffff",
          "b.color": "#111111",
        },
      }),
    );
    expect(left.ok).toBe(true);
    expect(right.ok).toBe(true);
    if (!left.ok || !right.ok) {
      throw new Error("Expected both graphs to compile");
    }
    expect(serializeCompiledScheme(left.value)).toBe(serializeCompiledScheme(right.value));
  });

  test("token insertion order does not change diagnostic order", () => {
    const left = parseTokenGraph({
      kind: colorTokenGraphKind,
      formatVersion: 1,
      modes: ["base"],
      defaultMode: "base",
      defaultVisibility: "public",
      tokens: {
        "z.token": { value: { ref: "missing.z" } },
        "a.token": { value: { ref: "missing.a" } },
      },
    });
    const right = parseTokenGraph({
      kind: colorTokenGraphKind,
      formatVersion: 1,
      modes: ["base"],
      defaultMode: "base",
      defaultVisibility: "public",
      tokens: {
        "a.token": { value: { ref: "missing.a" } },
        "z.token": { value: { ref: "missing.z" } },
      },
    });
    expect(left).toEqual(right);
  });

  test("deep reference chains are stack-safe", () => {
    const tokens: Record<string, { value: string | { ref: string } }> = {
      "chain.t00000": { value: "#000000" },
    };
    for (let index = 1; index <= 10_000; index += 1) {
      tokens[`chain.t${index.toString().padStart(5, "0")}`] = {
        value: { ref: `chain.t${(index - 1).toString().padStart(5, "0")}` },
      };
    }

    const result = compileTokenGraph(defineTokenGraph({ tokens }));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected chain graph to compile");
    }
    expect(Object.keys(result.value.tokens)).toHaveLength(10_001);
    expect(result.value.tokens["chain.t10000"]?.dependenciesByMode.base).toEqual(["chain.t09999"]);
  }, 20_000);
});
