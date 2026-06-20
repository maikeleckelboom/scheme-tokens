import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { compileTokenGraph, parseColor, parseTokenGraph, serializeScheme } from "../../src";

describe("determinism and parser safety properties", () => {
  test("parse boundaries do not throw for JSON values", () => {
    fc.assert(
      fc.property(fc.jsonValue(), (value) => {
        expect(() => parseColor(value)).not.toThrow();
        expect(() => parseTokenGraph(value)).not.toThrow();
      }),
      { numRuns: 100 },
    );
  });

  test("token insertion order does not change canonical serialization", () => {
    const left = compileTokenGraph({
      formatVersion: 1,
      modes: ["dark", "light"],
      defaultMode: "light",
      defaultVisibility: "public",
      tokens: {
        "b.color": { value: "#111111" },
        "a.color": { value: "#ffffff" },
      },
    });
    const right = compileTokenGraph({
      formatVersion: 1,
      modes: ["light", "dark"],
      defaultMode: "light",
      defaultVisibility: "public",
      tokens: {
        "a.color": { value: "#ffffff" },
        "b.color": { value: "#111111" },
      },
    });
    expect(left.ok).toBe(true);
    expect(right.ok).toBe(true);
    if (!left.ok || !right.ok) {
      throw new Error("Expected both graphs to compile");
    }
    expect(serializeScheme(left.value)).toBe(serializeScheme(right.value));
  });

  test("token insertion order does not change diagnostic order", () => {
    const left = parseTokenGraph({
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

    const result = compileTokenGraph({
      formatVersion: 1,
      modes: ["base"],
      defaultMode: "base",
      defaultVisibility: "public",
      tokens,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected chain graph to compile");
    }
    expect(Object.keys(result.value.tokens)).toHaveLength(10_001);
    expect(result.value.tokens["chain.t10000"]?.dependenciesByMode.base).toEqual(["chain.t09999"]);
  }, 20_000);
});
