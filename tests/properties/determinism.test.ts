import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { compileTokenGraph, parseColor, parseTokenGraph, serializeTokenSet } from "../../src";

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
    if (!left.ok || !right.ok) throw new Error("Expected both graphs to compile");
    expect(serializeTokenSet(left.value)).toBe(serializeTokenSet(right.value));
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
    if (!result.ok) throw new Error("Expected chain graph to compile");
    expect(Object.keys(result.value.tokens)).toHaveLength(10_001);
  }, 20_000);
});
